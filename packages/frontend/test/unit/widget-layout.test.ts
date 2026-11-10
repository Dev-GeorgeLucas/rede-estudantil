/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { defineComponent, effectScope, h, ref } from 'vue';
import { useWidgetLayout } from '@/composables/use-widget-layout.js';
import WidgetPanel from '@/ui/_common_/widget-panel.vue';
import { i18n } from '@/i18n.js';

const widgets = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock('@/ui/_common_/widgets.vue', async () => {
	const { defineComponent, onMounted, onUnmounted } = await import('vue');
	return { __esModule: true, default: defineComponent({ setup() { onMounted(widgets.mount); onUnmounted(widgets.unmount); }, template: '<button>Existing configured widget</button>' }) };
});

const originalWidth = window.innerWidth;
function resize(width: number) {
	Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
	window.dispatchEvent(new Event('resize'));
}
afterEach(() => { cleanup(); resize(originalWidth); vi.clearAllMocks(); });

test.each([320, 390, 500, 1099, 1100, 1440, 1920])('viewport %d chooses the column or drawer using one breakpoint', width => {
	resize(width);
	const scope = effectScope();
	const layout = scope.run(() => useWidgetLayout(() => false, () => false))!;
	expect(layout.isMobile.value).toBe(width <= 500);
	expect(layout.showWidgetsSide.value).toBe(width >= 1100);
	scope.stop();
});

test('wide pages keep the button available and cleanup releases the resize listener', () => {
	resize(390);
	const wide = ref(false);
	const remove = vi.spyOn(window, 'removeEventListener');
	const scope = effectScope();
	const layout = scope.run(() => useWidgetLayout(() => false, () => wide.value))!;
	layout.widgetsShowing.value = true;
	resize(1440);
	expect(layout.showWidgetsSide.value).toBe(true);
	wide.value = true;
	expect(layout.showWidgetsSide.value).toBe(false);
	wide.value = false;
	expect(layout.showWidgetsSide.value).toBe(true);
	resize(1099);
	expect(layout.showWidgetsSide.value).toBe(false);
	scope.stop();
	expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
	remove.mockRestore();
});

test('a user-selected phone layout does not force three columns on a large viewport', () => {
	resize(1440);
	const scope = effectScope();
	expect(scope.run(() => useWidgetLayout(() => true, () => false))!.showWidgetsSide.value).toBe(false);
	scope.stop();
});

test('moves the existing widget tree from drawer to column without duplicated mounts or leftover modal state', async () => {
	const target = document.createElement('aside');
	document.body.append(target);
	const view = render(WidgetPanel, { props: { modelValue: true } });
	await waitFor(() => expect(widgets.mount).toHaveBeenCalledOnce());
	expect(view.getByRole('dialog', { name: i18n.ts.widgets })).toBeTruthy();
	await view.rerender({ modelValue: true, container: target });
	await waitFor(() => expect(target.querySelector('button')?.textContent).toBe('Existing configured widget'));
	expect(view.queryByRole('dialog')).toBeNull();
	expect(view.emitted('update:modelValue')).toContainEqual([false]);
	expect(widgets.mount).toHaveBeenCalledOnce();
	expect(widgets.unmount).not.toHaveBeenCalled();
	expect(Array.from(document.body.querySelectorAll('[inert]')).filter(el => (el as HTMLElement).inert)).toHaveLength(0);
	await view.rerender({ modelValue: false, container: null });
	await waitFor(() => expect(widgets.unmount).toHaveBeenCalledOnce());
	expect(view.queryByText('Existing configured widget')).toBeNull();
	target.remove();
});

test.each(['escape', 'close'])('mobile closes with %s and manages focus without changing preferences', async action => {
	const view = render(WidgetPanel, { props: { modelValue: true } });
	const close = await view.findByRole('button', { name: i18n.ts.close });
	expect(document.activeElement).toBe(close);
	if (action === 'escape') await fireEvent.keyDown(close, { key: 'Escape' });
	else await fireEvent.click(close);
	expect(view.emitted('update:modelValue')).toEqual([[false]]);
});


test('real resize preserves the mounted widget while the column target is created in the next render', async () => {
	resize(390);
	let layout!: ReturnType<typeof useWidgetLayout>;
	const Harness = defineComponent({ setup() {
		layout = useWidgetLayout(() => false, () => false);
		layout.widgetsShowing.value = true;
		const container = ref<HTMLElement | null>(null);
		return () => h('div', [
			layout.showWidgetsSide.value ? h('aside', { ref: container }) : null,
			h(WidgetPanel, {
				container: container.value,
				modelValue: layout.widgetsShowing.value,
				'onUpdate:modelValue': (value: boolean) => { layout.widgetsShowing.value = value; },
			}),
		]);
	} });
	const view = render(Harness);
	await waitFor(() => expect(widgets.mount).toHaveBeenCalledOnce());
	resize(1440);
	await waitFor(() => expect(layout.widgetsShowing.value).toBe(false));
	expect(view.queryByRole('dialog')).toBeNull();
	expect(view.container.querySelector('aside button')?.textContent).toBe('Existing configured widget');
	expect(widgets.mount).toHaveBeenCalledOnce();
	expect(widgets.unmount).not.toHaveBeenCalled();
	expect(Array.from(document.body.querySelectorAll('[inert]')).filter(el => (el as HTMLElement).inert)).toHaveLength(0);
});
