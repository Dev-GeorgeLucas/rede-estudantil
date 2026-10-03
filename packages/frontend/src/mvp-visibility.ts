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

export type MvpSecondaryFeature = 'antennas' | 'pages' | 'play' | 'gallery' | 'rss' | 'statusbar' | 'deck' | 'userRaw' | 'profileDetails' | 'profileExtraActions';

export function isMvpFeatureVisible(_feature: MvpSecondaryFeature): boolean {
	return !simplifyMvp;
}

// Evaluate at consumption time, including after backup/profile restoration. Never persist the fallback.
export function getMvpUi(storedUi: string | null, loggedIn: boolean): string | null {
	return isMvpFeatureVisible('deck') ? storedUi : loggedIn ? 'default' : 'visitor';
}

const secondaryPaths: Partial<Record<MvpSecondaryFeature, RegExp>> = {
	antennas: /^\/(?:my\/antennas|timeline\/antenna)(?:\/|$)/,
	pages: /^\/(?:pages|@[^/]+\/pages)(?:\/|$)/,
	play: /^\/(?:play|@[^/]+\/(?:flashs|play))(?:\/|$)/,
	gallery: /^\/(?:gallery|@[^/]+\/gallery)(?:\/|$)/,
	statusbar: /^\/settings\/statusbar(?:\/|$)/,
	deck: /^\/settings\/deck(?:\/|$)/,
	userRaw: /^\/@[^/]+\/raw(?:\/|$)/,
	profileDetails: /^\/@[^/]+\/(?:activity|reactions|clips|lists)(?:\/|$)/,
};

const advancedPaths = [
	'/api-console', '/scratchpad', '/registry', '/debug', '/preview', '/clicker',
	'/settings/plugin', '/settings/custom-css', '/settings/webhook/new',
];

export function isMvpPathVisible(path: string): boolean {
	let pathname = path.split(/[?#]/)[0];
	try { pathname = decodeURIComponent(pathname); } catch { /* Match malformed URLs literally. */ }
	pathname = pathname.replace(/\/+/g, '/').replace(/\/$/, '');
	if (Object.entries(secondaryPaths).some(([feature, pattern]) => !isMvpFeatureVisible(feature as MvpSecondaryFeature) && pattern.test(pathname))) return false;
	if (path === '/about#charts') return canUseAdvancedFeatures();
	return canUseAdvancedFeatures() || !advancedPaths.some(base => pathname === base || pathname.startsWith(`${base}/`));
}

const advancedWidgets = new Set(['aiscript', 'aiscriptApp', 'button', 'serverMetric', 'jobQueue', 'unixClock', 'clicker']);

export function isMvpWidgetVisible(name: string, data?: Record<string, unknown>): boolean {
	if ((name === 'rss' || name === 'rssTicker') && !isMvpFeatureVisible('rss')) return false;
	if (name === 'timeline' && data?.src === 'antenna' && !isMvpFeatureVisible('antennas')) return false;
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
		if (item.id.startsWith('mvp-secondary-') && !isMvpFeatureVisible(item.id.slice('mvp-secondary-'.length) as MvpSecondaryFeature)) return false;
		if (item.path && !isMvpPathVisible(item.path)) return false;
		const parent = item.parentId ? byId.get(item.parentId) : undefined;
		return !parent || visible(parent, seen);
	}

	return items.filter(item => visible(item));
}
