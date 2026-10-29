/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { render, fireEvent, cleanup } from '@testing-library/vue';
import { hotkeyDirective } from '@/directives/hotkey.js';

test('post shortcuts leave keyboard buttons and links usable', async () => {
	const shortcut = vi.fn();
	const view = render(defineComponent({
		directives: { hotkey: hotkeyDirective },
		setup: () => ({ keys: { enter: shortcut } }),
		template: '<div v-hotkey.self="keys" tabindex="0" data-testid="post"><button>Like</button><a href="/notes/n">Details</a></div>',
	}));
	for (const target of [view.getByRole('button'), view.getByRole('link')]) {
		target.focus();
		const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	}
	expect(shortcut).not.toHaveBeenCalled();
	const root = view.getByTestId('post');
	root.focus();
	await fireEvent.keyDown(root, { key: 'Enter', keyCode: 13 });
	expect(shortcut).toHaveBeenCalledTimes(1);
	cleanup();
});
