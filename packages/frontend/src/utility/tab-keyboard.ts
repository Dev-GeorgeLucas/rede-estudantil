/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Tabs opt into the ARIA tab pattern by providing a panelId. Reuse their normal click action.
export function onTabKeydown(event: KeyboardEvent): void {
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
	const list = event.currentTarget as HTMLElement;
	if (list.getAttribute('role') !== 'tablist') return;
	const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
	const index = tabs.indexOf(event.target as HTMLButtonElement);
	if (index < 0) return;
	let next: number;
	switch (event.key) {
		case 'ArrowRight': next = (index + 1) % tabs.length; break;
		case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
		case 'Home': next = 0; break;
		case 'End': next = tabs.length - 1; break;
		default: return;
	}
	event.preventDefault();
	tabs[next].focus();
	tabs[next].click();
}
