/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { SystemWebhookService } from '@/core/SystemWebhookService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { sanitizeModerationLog, protectedModerationLogTypes } from '@/misc/sanitize-moderation-log.js';
import ShowLogs, { meta } from '@/server/api/endpoints/admin/show-moderation-logs.js';
import type { MiModerationLog } from '@/models/ModerationLog.js';

const actor = { id: 'fictionaladmin' };
const user = { ...actor, username: 'fictional-admin' };
const date = new Date('2026-01-01T00:00:00Z');
const types = ['createSystemWebhook', 'updateSystemWebhook', 'deleteSystemWebhook'] as const;

function entity(marker = 'OLD') {
	return {
		id: 'fictionalwebhook', isActive: false, on: ['abuseReport'],
		url: `https://${marker}-USER:${marker}-PASSWORD@${marker}-HOST.example.invalid/${marker}-PATH?key=${marker}-TOKEN#${marker}-FRAGMENT`,
		secret: `${marker}-SECRET`, name: `${marker}-FREE-TEXT`,
		unknown: { nested: `${marker}-UNKNOWN` }, latestStatus: 500,
	};
}

const safe = { id: 'fictionalwebhook', isActive: false, on: ['abuseReport'] };

function info(type: typeof types[number]) {
	return type === 'updateSystemWebhook'
		? { systemWebhookId: safe.id, before: entity(), after: { ...entity('NEW'), isActive: true, on: ['userCreated'] }, unknown: 'TOP-UNKNOWN' }
		: { systemWebhookId: safe.id, webhook: entity(), unknown: 'TOP-UNKNOWN' };
}

function services() {
	const insert = vi.fn().mockResolvedValue({});
	const repository = { insert, findOneByOrFail: vi.fn() };
	const ids = { gen: () => 'fictionallog', parse: () => ({ date }) };
	const users = { pack: vi.fn().mockResolvedValue(user), packMany: vi.fn().mockResolvedValue([user]) };
	return {
		insert, repository,
		logger: new ModerationLogService(repository as never, ids as never),
		packer: new ModerationLogEntityService(repository as never, users as never, ids as never),
	};
}

function historical(type: typeof types[number], payload: unknown) {
	return { id: 'fictionallog', userId: actor.id, type, info: payload } as MiModerationLog;
}

function expected(type: typeof types[number]) {
	return type === 'updateSystemWebhook'
		? { systemWebhookId: safe.id, before: safe, after: { ...safe, isActive: true, on: ['userCreated'] }, changedFields: ['isActive', 'on', 'name', 'url', 'secret'] }
		: { systemWebhookId: safe.id, webhook: safe };
}

describe('system webhook audit projections', () => {
	test.each(types)('%s protects persistence even for callers supplying raw snapshots', async type => {
		const payload = info(type);
		const original = structuredClone(payload);
		const { logger, insert } = services();
		await logger.log(actor, type, payload as never);
		expect(insert).toHaveBeenCalledWith({ id: 'fictionallog', userId: actor.id, type, info: expected(type) });
		expect(payload).toEqual(original);
	});

	test.each(types)('%s protects historical pack, pack by ID, packMany and HTTP endpoint executor', async type => {
		const stored = historical(type, info(type));
		const original = structuredClone(stored);
		const { packer, repository } = services();
		repository.findOneByOrFail.mockResolvedValue(stored);
		for (const source of [stored, stored.id]) {
			const packed = await packer.pack(source);
			expect(packed.info).toEqual(expected(type));
			expect(packed).toMatchObject({ id: stored.id, type, userId: actor.id, user, createdAt: date.toISOString() });
		}
		const query = { andWhere: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([stored]) };
		const endpoint = new ShowLogs({ createQueryBuilder: () => query } as never, packer, { makePaginationQuery: () => query } as never);
		const response = await endpoint.exec({ type, limit: 1, search: 'fictional' }, actor as never, null);
		expect(response[0].info).toEqual(expected(type));
		expect(query.andWhere).toHaveBeenCalledWith('(CASE WHEN log.type IN (:...protectedTypes) THEN log.type ELSE log.info::text END) ILIKE :search', { protectedTypes: [...protectedModerationLogTypes], search: '%fictional%' });
		for (const marker of ['OLD-', 'NEW-', 'TOP-UNKNOWN', 'unknown', 'latestStatus']) expect(JSON.stringify(response)).not.toContain(marker);
		expect(stored).toEqual(original);
	});

	test.each(types)('%s is idempotent across caller, persistence and read boundaries', type => {
		const once = sanitizeModerationLog(type, info(type));
		expect(sanitizeModerationLog(type, once)).toEqual(once);
	});

	test.each(types.flatMap(type => [null, undefined, {}, { webhook: null, before: null, after: null }].map(payload => ({ type, payload }))))('handles missing/null legacy data for $type', ({ type, payload }) => {
		const projected = sanitizeModerationLog(type, payload);
		expect(projected).toEqual(type === 'updateSystemWebhook' ? { systemWebhookId: '', before: {}, after: {}, changedFields: [] } : { systemWebhookId: '', webhook: {} });
	});

	test('rejects nested values, unknown fields/events and malformed IDs even in allowlisted positions', () => {
		const payload = { systemWebhookId: 'https://SECRET.invalid', webhook: { id: { nested: 'SECRET' }, isActive: { nested: 'SECRET' }, on: ['abuseReport', 'SECRET', { nested: 'SECRET' }], name: 'SECRET' } };
		expect(sanitizeModerationLog('createSystemWebhook', payload)).toEqual({ systemWebhookId: '', webhook: { on: ['abuseReport'] } });
		const updated = sanitizeModerationLog('updateSystemWebhook', { changedFields: ['secret', 'UNKNOWN', { nested: 'SECRET' }], before: { on: { nested: 'SECRET' } }, after: {} });
		expect(updated).toEqual({ systemWebhookId: '', before: {}, after: {}, changedFields: ['on', 'secret'] });
	});

	test('does not claim unchanged protected fields changed; still tracks removals', () => {
		const before = entity();
		expect(sanitizeModerationLog('updateSystemWebhook', { before, after: structuredClone(before) })).toMatchObject({ changedFields: [] });
		expect(sanitizeModerationLog('updateSystemWebhook', { before, after: { ...before, secret: null } })).toMatchObject({ changedFields: ['secret'] });
	});

	test('history retains the existing administrator-only permission and scope', () => {
		expect(meta).toMatchObject({ requireCredential: true, requireAdmin: true, kind: 'read:admin:show-moderation-log' });
	});
});

describe('system webhook CRUD keeps effective settings separate from the log', () => {
	test('create, update and delete preserve entities and internal events, projecting only audit copies', async () => {
		let effective = entity();
		const { logger, insert } = services();
		const repository = {
			insert: vi.fn(async value => { effective = { ...effective, ...value }; }),
			update: vi.fn(async (_id, value) => { effective = { ...effective, ...value }; }),
			delete: vi.fn().mockResolvedValue({}),
			findOneByOrFail: vi.fn(async () => structuredClone(effective)),
		};
		const redis = { on: vi.fn(), off: vi.fn() };
		const events = { publishInternalEvent: vi.fn() };
		const queue = { systemWebhookDeliver: vi.fn() };
		const service = new SystemWebhookService(redis as never, repository as never, { gen: () => safe.id } as never, queue as never, logger, events as never);
		const created = await service.createSystemWebhook(entity() as never, actor as never);
		expect(created).toEqual(entity());
		expect(events.publishInternalEvent).toHaveBeenLastCalledWith('systemWebhookCreated', created);
		expect(insert.mock.calls.at(-1)?.[0].info).toEqual(expected('createSystemWebhook'));
		const updated = await service.updateSystemWebhook({ ...entity('NEW'), isActive: true, on: ['userCreated'] } as never, actor as never);
		expect(updated).toMatchObject({ ...entity('NEW'), unknown: entity().unknown, isActive: true, on: ['userCreated'] });
		expect(repository.update.mock.calls[0][1]).toMatchObject({ url: entity('NEW').url, secret: entity('NEW').secret });
		expect(events.publishInternalEvent).toHaveBeenLastCalledWith('systemWebhookUpdated', updated);
		expect(insert.mock.calls.at(-1)?.[0].info).toEqual(expected('updateSystemWebhook'));
		await service.deleteSystemWebhook(safe.id, actor as never);
		expect(repository.delete).toHaveBeenCalledWith(safe.id);
		expect(events.publishInternalEvent).toHaveBeenLastCalledWith('systemWebhookDeleted', updated);
		expect(insert.mock.calls.at(-1)?.[0].info).toEqual({ systemWebhookId: safe.id, webhook: { ...safe, isActive: true, on: ['userCreated'] } });
		expect(queue.systemWebhookDeliver).not.toHaveBeenCalled();
		service.onApplicationShutdown();
		expect(redis.off).toHaveBeenCalledWith('message', expect.any(Function));
	});
});
