/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import ModLog from '@/pages/admin/modlog.ModLog.vue';
import { i18n } from '@/i18n.js';

vi.mock('@/components/MkFolder.vue', () => ({ default: { template: '<section><slot name="label"/><slot name="suffix"/><slot/></section>' } }));
vi.mock('v-code-diff', () => ({ CodeDiff: { props: ['oldString', 'newString'], template: '<div data-testid="diff"><pre>{{ oldString }}</pre><pre>{{ newString }}</pre></div>' } }));

afterEach(cleanup);

describe('configuration moderation log presentation', () => {
	test.each([
		{ before: { enableEmail: false }, after: { enableEmail: true }, changedFields: ['enableEmail', 'smtpPass'] },
		{ before: {}, after: {}, changedFields: ['smtpPass'] },
		{ before: null, after: null },
	])('renders protected and legacy empty events: %j', info => {
		const view = render(ModLog, {
			props: { log: { id: 'fictionallog', type: 'updateServerSettings', userId: 'fictionaladmin', createdAt: '2026-01-01T00:00:00Z', user: { username: 'fictional-admin' }, info } as never },
			global: { components: {
				MkA: { props: ['to'], template: '<a :href="to"><slot/></a>' },
				MkTime: { props: ['time'], template: '<time>{{ time }}</time>' },
			} },
		});
		expect(view.getByRole('link', { name: '@fictional-admin' }).getAttribute('href')).toBe('/admin/user/fictionaladmin');
		expect(view.getAllByText('2026-01-01T00:00:00Z').length).toBeGreaterThan(0);
		expect(view.getByTestId('diff')).toBeTruthy();
		if (info.changedFields) expect(view.getByText(`${i18n.ts.settings}: ${info.changedFields.join(', ')}`)).toBeTruthy();
		if ('enableEmail' in (info.after ?? {})) {
			expect(view.getByTestId('diff').textContent).toContain('false');
			expect(view.getByTestId('diff').textContent).toContain('true');
		}
	});
});
