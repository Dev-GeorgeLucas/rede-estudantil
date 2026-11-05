/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { sanitizeServerSettingsLog } from '@/misc/sanitize-server-settings-log.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import UpdateMeta, { meta as updateMeta } from '@/server/api/endpoints/admin/update-meta.js';
import UpdatePolicies, { meta as policiesMeta } from '@/server/api/endpoints/admin/roles/update-default-policies.js';
import ShowLogs, { meta as showMeta } from '@/server/api/endpoints/admin/show-moderation-logs.js';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import type { MiMeta } from '@/models/Meta.js';
import type { MiModerationLog } from '@/models/ModerationLog.js';

const credentials = [
	'hcaptchaSecretKey', 'mcaptchaSecretKey', 'recaptchaSecretKey', 'turnstileSecretKey',
	'sensitiveMediaDetectionApiKey', 'smtpPass', 'smtpUser', 'swPrivateKey',
	'deeplAuthKey', 'objectStorageAccessKey', 'objectStorageSecretKey',
	'verifymailAuthKey', 'truemailAuthKey',
];
const urls = [
	'mascotImageUrl', 'bannerUrl', 'backgroundImageUrl', 'logoImageUrl', 'iconUrl',
	'app192IconUrl', 'app512IconUrl', 'serverErrorImageUrl', 'notFoundImageUrl', 'infoImageUrl',
	'mcaptchaInstanceUrl', 'sensitiveMediaDetectionApiUrl', 'termsOfServiceUrl', 'repositoryUrl',
	'feedbackUrl', 'impressumUrl', 'privacyPolicyUrl', 'inquiryUrl', 'objectStorageBaseUrl',
	'objectStorageEndpoint', 'truemailInstance', 'urlPreviewSummaryProxyUrl', 'summalyProxy', 'smtpHost',
];
const actor = { id: 'fictionaladmin' };
const date = new Date('2026-01-01T00:00:00Z');
const user = { id: actor.id, username: 'fictional-admin' };

function services() {
	const insert = vi.fn().mockResolvedValue({});
	const repository = { insert, findOneByOrFail: vi.fn() };
	const ids = { gen: () => 'fictionallog', parse: () => ({ date }) };
	const users = { pack: vi.fn().mockResolvedValue(user), packMany: vi.fn().mockResolvedValue([user]) };
	const logger = new ModerationLogService(repository as never, ids as never);
	const packer = new ModerationLogEntityService(repository as never, users as never, ids as never);
	return { insert, repository, logger, packer };
}

function historical(info: unknown, type = 'updateServerSettings') {
	return { id: 'fictionallog', userId: actor.id, type, info } as MiModerationLog;
}

function queryFor(logs: MiModerationLog[]) {
	return { andWhere: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue(logs) };
}

describe('configuration moderation logs', () => {
	test.each([...credentials, ...urls])('never persists or returns old/new values of %s', async field => {
		const before = `https://fake-user:OLD-SECRET@example.invalid/OLD-PATH?key=OLD-TOKEN#OLD-FRAGMENT`;
		const after = `https://fake-user:NEW-SECRET@example.invalid/NEW-PATH?key=NEW-TOKEN#NEW-FRAGMENT`;
		const info = { before: { [field]: before }, after: { [field]: after } };
		const original = structuredClone(info);
		const { logger, insert, packer } = services();
		// Exercise the persistence boundary even if a caller bypasses the endpoint projection.
		await logger.log(actor, 'updateServerSettings', info as never);
		expect(insert.mock.calls[0][0]).toEqual({
			id: 'fictionallog', userId: actor.id, type: 'updateServerSettings',
			info: { before: {}, after: {}, changedFields: [field] },
		});
		const packed = await packer.pack(historical(info));
		expect(packed.info).toEqual({ before: {}, after: {}, changedFields: [field] });
		expect(packed).toMatchObject({ userId: actor.id, user, type: 'updateServerSettings', createdAt: date.toISOString() });
		const serialized = JSON.stringify([insert.mock.calls, packed]);
		for (const secret of ['OLD-SECRET', 'NEW-SECRET', 'OLD-PATH', 'NEW-PATH', 'OLD-TOKEN', 'NEW-TOKEN', 'OLD-FRAGMENT', 'NEW-FRAGMENT']) {
			expect(serialized).not.toContain(secret);
		}
		expect(info).toEqual(original);
	});

	test('does not log unchanged credentials or automatically admit unknown fields, keys or nested values', () => {
		const info = {
			before: { smtpPass: 'UNCHANGED-SECRET', disableRegistration: false },
			after: {
				smtpPass: 'UNCHANGED-SECRET', disableRegistration: true, futureCredential: 'NEW-SECRET',
				manifestJsonOverride: '{"secret":"NESTED-SECRET"}',
				policies: { canInvite: true, unknown: 'NESTED-SECRET' },
				clientOptions: { showActivitiesForVisitor: false, unknown: 'NESTED-SECRET' },
			},
			changedFields: ['UNKNOWN-SECRET', 'futureCredential', '__proto__'],
			extra: 'EXTRA-SECRET',
		};
		const sanitized = sanitizeServerSettingsLog(info);
		expect(sanitized.before).toEqual({ disableRegistration: false });
		expect(sanitized.after).toEqual({ disableRegistration: true, 'policies.canInvite': true, 'clientOptions.showActivitiesForVisitor': false });
		expect(sanitized.changedFields).not.toContain('smtpPass');
		expect(JSON.stringify(sanitized)).not.toMatch(/SECRET|futureCredential|unknown|__proto__/);
		expect(sanitizeServerSettingsLog(sanitized)).toEqual(sanitized);
	});

	test.each([undefined, null, [], 'malformed', {}, { before: null, after: null }])('handles missing and legacy malformed payloads: %j', async info => {
		const { packer, repository } = services();
		repository.findOneByOrFail.mockResolvedValue(historical(info));
		expect((await packer.pack('fictionallog')).info).toEqual({ before: {}, after: {}, changedFields: [] });
	});

	test('tracks clearing a secret without retaining even its null value; checks safe value types', () => {
		expect(sanitizeServerSettingsLog({ before: { smtpPass: 'SECRET' }, after: { smtpPass: null } }))
			.toEqual({ before: {}, after: {}, changedFields: ['smtpPass'] });
		const info = sanitizeServerSettingsLog({ before: { notesPerOneAd: null }, after: { notesPerOneAd: 5, disableRegistration: 'SECRET', enableEmail: { password: 'SECRET' }, urlPreviewTimeout: Infinity } });
		expect(info.before).toEqual({ notesPerOneAd: null });
		expect(info.after).toEqual({ notesPerOneAd: 5 });
		expect(JSON.stringify(info)).not.toContain('SECRET');
	});

	test('update-meta applies actual credentials while passing only a separate safe projection to the logger', async () => {
		const before = Object.freeze({ smtpPass: 'OLD-SECRET', disableRegistration: false, name: 'Old instance' });
		let current = before as Partial<MiMeta>;
		const update = vi.fn(async (set: Partial<MiMeta>) => { current = { ...current, ...set }; });
		const metaService = { fetch: vi.fn(async () => current), update };
		const { logger, insert } = services();
		const log = vi.spyOn(logger, 'log');
		const endpoint = new UpdateMeta({} as never, metaService as never, logger);
		await endpoint.exec({ smtpPass: 'NEW-SECRET', disableRegistration: true, name: 'New instance' }, actor as never, null);
		expect(current).toEqual({ smtpPass: 'NEW-SECRET', disableRegistration: true, name: 'New instance' });
		expect(before).toEqual({ smtpPass: 'OLD-SECRET', disableRegistration: false, name: 'Old instance' });
		expect(update).toHaveBeenCalledWith({ smtpPass: 'NEW-SECRET', disableRegistration: true, name: 'New instance' });
		expect(log.mock.calls[0][2]).toEqual({ before: { disableRegistration: false }, after: { disableRegistration: true }, changedFields: ['name', 'disableRegistration', 'smtpPass'] });
		expect(JSON.stringify(insert.mock.calls)).not.toContain('SECRET');
	});

	test('default policy changes and legacy flat policy logs retain safe audit values', async () => {
		let current = { policies: { canInvite: false }, smtpPass: 'UNRELATED-SECRET' };
		const metaService = { fetch: vi.fn(async () => current), update: vi.fn(async ({ policies }) => { current = { ...current, policies }; }) };
		const events = { publishInternalEvent: vi.fn() };
		const { logger, insert, packer } = services();
		await new UpdatePolicies(metaService as never, events as never, logger).exec({ policies: { canInvite: true } }, actor as never, null);
		expect(current.policies).toEqual({ canInvite: true });
		expect(events.publishInternalEvent).toHaveBeenCalledWith('policiesUpdated', { canInvite: true });
		expect(insert.mock.calls[0][0].info.after).toEqual({ 'policies.canInvite': true });
		expect(JSON.stringify(insert.mock.calls)).not.toContain('SECRET');
		expect((await packer.pack(historical({ before: { canInvite: false }, after: { canInvite: true } }))).info)
			.toEqual({ before: { canInvite: false }, after: { canInvite: true }, changedFields: ['canInvite'] });
	});

	test('show-moderation-logs serializes historical snapshots and never searches their raw JSON', async () => {
		const stored = historical({ before: { smtpPass: 'OLD-SECRET', enableEmail: false }, after: { smtpPass: 'NEW-SECRET', enableEmail: true } });
		const original = structuredClone(stored);
		const query = queryFor([stored]);
		const { packer } = services();
		const endpoint = new ShowLogs({ createQueryBuilder: () => query } as never, packer, { makePaginationQuery: () => query } as never);
		const response = await endpoint.exec({ search: 'fictional', limit: 1, type: 'updateServerSettings' }, actor as never, null);
		expect(response[0].info).toEqual({ before: { enableEmail: false }, after: { enableEmail: true }, changedFields: ['enableEmail', 'smtpPass'] });
		expect(JSON.stringify(response)).not.toContain('SECRET');
		expect(stored).toEqual(original);
		expect(query.andWhere).toHaveBeenCalledWith('(CASE WHEN log.type = :settingsType THEN log.type ELSE log.info::text END) ILIKE :search', { settingsType: 'updateServerSettings', search: '%fictional%' });
	});

	test('other moderation events are unchanged', async () => {
		const info = { userId: 'fictionaluser', userUsername: 'fictional', userHost: null };
		const { logger, insert, packer } = services();
		await logger.log(actor, 'suspend', info);
		expect(insert.mock.calls[0][0].info).toEqual(info);
		expect((await packer.pack(historical(info, 'suspend'))).info).toEqual(info);
	});
});

describe('configuration log authorization at the API boundary', () => {
	test.each([updateMeta, policiesMeta, showMeta])('preserves administrator authorization for %j', async meta => {
		for (const role of ['visitor', 'user', 'moderator', 'admin']) {
			const exec = vi.fn().mockResolvedValue([]);
			const service = new ApiCallService(
				{ rootUserId: 'root', enableIpLogging: false } as never, {} as never, {} as never,
				{ authenticate: vi.fn().mockResolvedValue([role === 'visitor' ? null : actor, null]) } as never,
				{} as never,
				{ getUserRoles: vi.fn().mockResolvedValue([{ isModerator: role === 'moderator', isAdministrator: role === 'admin' }]) } as never,
				{ logger: {} } as never,
				{ startSpan: (_name: string, cb: () => unknown) => cb() } as never,
			);
			try {
				const reply = { code: vi.fn(), header: vi.fn(), send: vi.fn() };
				await service.handleRequest({ name: 'fictional', meta, params: {}, exec } as never, { method: 'POST', body: {}, query: {}, headers: {}, ip: '127.0.0.1' } as never, reply as never);
				expect(exec).toHaveBeenCalledTimes(role === 'admin' ? 1 : 0);
				if (role !== 'admin') expect(reply.send.mock.calls[0][0].error.code).toBe(role === 'visitor' ? 'CREDENTIAL_REQUIRED' : 'ROLE_PERMISSION_DENIED');
			} finally {
				service.dispose();
			}
		}
	});
});
