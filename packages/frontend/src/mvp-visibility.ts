/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import type { SearchIndexItem } from '@/utility/inapp-search.js';

// Presentation policy only: APIs, stored preferences and moderation permissions stay intact.
// Disable this flag to restore the advanced interface without rewriting user data.
const simplifyMvp = true;

export function canUseAdvancedFeatures(): boolean {
	return !simplifyMvp || $i?.isAdmin === true;
}

const advancedPaths = [
	'/api-console', '/scratchpad', '/registry', '/debug', '/preview', '/clicker',
	'/settings/plugin', '/settings/custom-css', '/settings/webhook/new',
];

export function isMvpPathVisible(path: string): boolean {
	const pathname = path.split(/[?#]/)[0].replace(/\/$/, '');
	if (path === '/about#charts') return canUseAdvancedFeatures();
	return canUseAdvancedFeatures() || !advancedPaths.some(base => pathname === base || pathname.startsWith(`${base}/`));
}

const advancedWidgets = new Set(['aiscript', 'aiscriptApp', 'button', 'serverMetric', 'jobQueue', 'unixClock', 'clicker']);

export function isMvpWidgetVisible(name: string): boolean {
	return canUseAdvancedFeatures() || !advancedWidgets.has(name);
}

// Keep hidden widgets in their original slots when the visible subset is reordered.
export function mergeVisibleItems<T>(stored: readonly T[], visible: readonly T[], isVisible: (item: T) => boolean): T[] {
	let index = 0;
	const merged = stored.flatMap(item => {
		if (!isVisible(item)) return [item];
		return index < visible.length ? [visible[index++]] : [];
	});
	return [...merged, ...visible.slice(index)];
}

export function filterMvpSearchIndex(items: SearchIndexItem[]): SearchIndexItem[] {
	const byId = new Map(items.map(item => [item.id, item]));

	function visible(item: SearchIndexItem, seen = new Set<string>()): boolean {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		if (!canUseAdvancedFeatures() && item.id.startsWith('mvp-advanced-')) return false;
		if (item.path && !isMvpPathVisible(item.path)) return false;
		const parent = item.parentId ? byId.get(item.parentId) : undefined;
		return !parent || visible(parent, seen);
	}

	return items.filter(item => visible(item));
}
