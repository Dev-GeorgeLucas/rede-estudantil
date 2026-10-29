/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function shouldOpenNote(event: MouseEvent, selection: string): boolean {
	if (event.defaultPrevented || event.button !== 0 || selection.length > 0) return false;
	const target = event.target;
	return target instanceof Element && !target.closest('a, button, input, textarea, select, video, audio, img, canvas, summary, [role="button"], [contenteditable], [data-note-interactive]');
}
