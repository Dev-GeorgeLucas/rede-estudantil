/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isDeepStrictEqual } from 'node:util';
import type { SystemWebhookEventType } from '@/models/SystemWebhook.js';

// Keep this list explicit: new entity fields and event types require a privacy review.
const safeEvents = [
	'abuseReport', 'abuseReportResolved', 'userCreated',
	'inactiveModeratorsWarning', 'inactiveModeratorsInvitationOnlyChanged',
] as const satisfies readonly SystemWebhookEventType[];
const trackedFields = ['isActive', 'on', 'name', 'url', 'secret'] as const;
type ChangedField = typeof trackedFields[number];
export type SystemWebhookLogSnapshot = { id?: string; isActive?: boolean; on?: SystemWebhookEventType[] };
export type SystemWebhookSnapshotLog = { systemWebhookId: string; webhook: SystemWebhookLogSnapshot };
export type SystemWebhookUpdateLog = {
	systemWebhookId: string;
	before: SystemWebhookLogSnapshot;
	after: SystemWebhookLogSnapshot;
	changedFields: ChangedField[];
};

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeId(value: unknown): string | undefined {
	return typeof value === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(value) ? value : undefined;
}

function snapshot(value: unknown): SystemWebhookLogSnapshot {
	const source = record(value);
	const result: SystemWebhookLogSnapshot = {};
	const id = safeId(source.id);
	if (id !== undefined) result.id = id;
	if (typeof source.isActive === 'boolean') result.isActive = source.isActive;
	if (Array.isArray(source.on)) {
		result.on = safeEvents.filter(event => (source.on as unknown[]).includes(event));
	}
	// name is free text and may itself contain credentials. Never retain it.
	return result;
}

export function sanitizeSystemWebhookSnapshotLog(info: unknown): SystemWebhookSnapshotLog {
	const source = record(info);
	const webhook = snapshot(source.webhook);
	return { systemWebhookId: safeId(source.systemWebhookId) ?? webhook.id ?? '', webhook };
}

export function sanitizeSystemWebhookUpdateLog(info: unknown): SystemWebhookUpdateLog {
	const source = record(info);
	const before = record(source.before);
	const after = record(source.after);
	return {
		systemWebhookId: safeId(source.systemWebhookId) ?? safeId(before.id) ?? safeId(after.id) ?? '',
		before: snapshot(before),
		after: snapshot(after),
		changedFields: trackedFields.filter(field =>
			!isDeepStrictEqual(before[field], after[field]) ||
			(Array.isArray(source.changedFields) && source.changedFields.includes(field))),
	};
}
