/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { sanitizeServerSettingsLog } from '@/misc/sanitize-server-settings-log.js';
import { sanitizeSystemWebhookSnapshotLog, sanitizeSystemWebhookUpdateLog } from '@/misc/sanitize-system-webhook-log.js';

// Also used by history search, which must not match raw historical secrets.
export const protectedModerationLogTypes = [
	'updateServerSettings', 'createSystemWebhook', 'updateSystemWebhook', 'deleteSystemWebhook',
] as const;

export function sanitizeModerationLog(type: string, info: unknown) {
	switch (type) {
		case 'updateServerSettings': return sanitizeServerSettingsLog(info);
		case 'createSystemWebhook':
		case 'deleteSystemWebhook': return sanitizeSystemWebhookSnapshotLog(info);
		case 'updateSystemWebhook': return sanitizeSystemWebhookUpdateLog(info);
		default: return info;
	}
}
