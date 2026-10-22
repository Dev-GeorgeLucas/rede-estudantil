/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Directive } from 'vue';
import { makeHotkey } from '@/utility/hotkey.js';
import type { Keymap } from '@/utility/hotkey.js';

const abortControllers = new WeakMap<HTMLElement, AbortController>();

export const hotkeyDirective = {
	mounted(el, binding) {
		const isGlobal = (binding.modifiers.global === true);
		const handler = makeHotkey(binding.value);
		const keyHandler = (event: KeyboardEvent) => {
			if (binding.modifiers.self && event.target !== el) return;
			handler(event);
		};
		const abortController = new AbortController();

		if (isGlobal) {
			window.document.addEventListener('keydown', keyHandler, { passive: false, signal: abortController.signal });
		} else {
			el.addEventListener('keydown', keyHandler, { passive: false, signal: abortController.signal });
		}

		abortControllers.set(el, abortController);
	},

	beforeUnmount(el) {
		const abortController = abortControllers.get(el);
		if (abortController) {
			abortController.abort();
			abortControllers.delete(el);
		}
	},
} as Directive<HTMLElement, Keymap>;
