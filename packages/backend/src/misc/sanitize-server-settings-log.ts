/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isDeepStrictEqual } from 'node:util';
import type { MiMeta } from '@/models/Meta.js';
import type { RolePolicies } from '@/core/RoleService.js';

// Fail closed: only explicitly reviewed booleans/numbers retain values.
// Text, URLs (including userinfo, query and path credentials), credentials and
// arbitrary objects record the field name only. New fields must be reviewed here.
type Rule = 'boolean' | 'number' | 'changedOnly';
const metaFields = {
	name: 'changedOnly',
	shortName: 'changedOnly',
	description: 'changedOnly',
	maintainerName: 'changedOnly',
	maintainerEmail: 'changedOnly',
	disableRegistration: 'boolean',
	langs: 'changedOnly',
	pinnedUsers: 'changedOnly',
	hiddenTags: 'changedOnly',
	blockedHosts: 'changedOnly',
	sensitiveWords: 'changedOnly',
	prohibitedWords: 'changedOnly',
	prohibitedWordsForNameOfUser: 'changedOnly',
	silencedHosts: 'changedOnly',
	mediaSilencedHosts: 'changedOnly',
	themeColor: 'changedOnly',
	mascotImageUrl: 'changedOnly',
	bannerUrl: 'changedOnly',
	backgroundImageUrl: 'changedOnly',
	logoImageUrl: 'changedOnly',
	iconUrl: 'changedOnly',
	app192IconUrl: 'changedOnly',
	app512IconUrl: 'changedOnly',
	serverErrorImageUrl: 'changedOnly',
	notFoundImageUrl: 'changedOnly',
	infoImageUrl: 'changedOnly',
	cacheRemoteFiles: 'boolean',
	cacheRemoteSensitiveFiles: 'boolean',
	emailRequiredForSignup: 'boolean',
	enableHcaptcha: 'boolean',
	hcaptchaSiteKey: 'changedOnly',
	hcaptchaSecretKey: 'changedOnly',
	enableMcaptcha: 'boolean',
	mcaptchaSitekey: 'changedOnly',
	mcaptchaSecretKey: 'changedOnly',
	mcaptchaInstanceUrl: 'changedOnly',
	enableRecaptcha: 'boolean',
	recaptchaSiteKey: 'changedOnly',
	recaptchaSecretKey: 'changedOnly',
	enableTurnstile: 'boolean',
	turnstileSiteKey: 'changedOnly',
	turnstileSecretKey: 'changedOnly',
	enableTestcaptcha: 'boolean',
	sensitiveMediaDetection: 'changedOnly',
	sensitiveMediaDetectionSensitivity: 'changedOnly',
	setSensitiveFlagAutomatically: 'boolean',
	enableSensitiveMediaDetectionForVideos: 'boolean',
	sensitiveMediaDetectionApiUrl: 'changedOnly',
	sensitiveMediaDetectionApiKey: 'changedOnly',
	sensitiveMediaDetectionTimeout: 'number',
	sensitiveMediaDetectionMaxImagesPerRequest: 'number',
	enableEmail: 'boolean',
	email: 'changedOnly',
	smtpSecure: 'boolean',
	smtpHost: 'changedOnly',
	smtpPort: 'changedOnly',
	smtpUser: 'changedOnly',
	smtpPass: 'changedOnly',
	enableServiceWorker: 'boolean',
	swPublicKey: 'changedOnly',
	swPrivateKey: 'changedOnly',
	deeplAuthKey: 'changedOnly',
	deeplIsPro: 'boolean',
	termsOfServiceUrl: 'changedOnly',
	repositoryUrl: 'changedOnly',
	feedbackUrl: 'changedOnly',
	impressumUrl: 'changedOnly',
	privacyPolicyUrl: 'changedOnly',
	inquiryUrl: 'changedOnly',
	defaultLightTheme: 'changedOnly',
	defaultDarkTheme: 'changedOnly',
	useObjectStorage: 'boolean',
	objectStorageBucket: 'changedOnly',
	objectStoragePrefix: 'changedOnly',
	objectStorageBaseUrl: 'changedOnly',
	objectStorageEndpoint: 'changedOnly',
	objectStorageRegion: 'changedOnly',
	objectStorageAccessKey: 'changedOnly',
	objectStorageSecretKey: 'changedOnly',
	objectStoragePort: 'changedOnly',
	objectStorageUseSSL: 'boolean',
	objectStorageUseProxy: 'boolean',
	objectStorageSetPublicRead: 'boolean',
	objectStorageS3ForcePathStyle: 'boolean',
	enableIpLogging: 'boolean',
	enableActiveEmailValidation: 'boolean',
	enableVerifymailApi: 'boolean',
	verifymailAuthKey: 'changedOnly',
	enableTruemailApi: 'boolean',
	truemailInstance: 'changedOnly',
	truemailAuthKey: 'changedOnly',
	enableChartsForRemoteUser: 'boolean',
	enableChartsForFederatedInstances: 'boolean',
	enableStatsForFederatedInstances: 'boolean',
	enableServerMachineStats: 'boolean',
	enableIdenticonGeneration: 'boolean',
	policies: 'changedOnly',
	serverRules: 'changedOnly',
	manifestJsonOverride: 'changedOnly',
	bannedEmailDomains: 'changedOnly',
	preservedUsernames: 'changedOnly',
	enableFanoutTimeline: 'boolean',
	enableFanoutTimelineDbFallback: 'boolean',
	perLocalUserUserTimelineCacheMax: 'number',
	perRemoteUserUserTimelineCacheMax: 'number',
	perUserHomeTimelineCacheMax: 'number',
	perUserListTimelineCacheMax: 'number',
	enableReactionsBuffering: 'boolean',
	notesPerOneAd: 'number',
	urlPreviewEnabled: 'boolean',
	urlPreviewAllowRedirect: 'boolean',
	urlPreviewTimeout: 'number',
	urlPreviewMaximumContentLength: 'number',
	urlPreviewRequireContentLength: 'boolean',
	urlPreviewSummaryProxyUrl: 'changedOnly',
	urlPreviewUserAgent: 'changedOnly',
	urlPreviewSensitiveList: 'changedOnly',
	federation: 'changedOnly',
	federationHosts: 'changedOnly',
	ugcVisibilityForVisitor: 'changedOnly',
	googleAnalyticsMeasurementId: 'changedOnly',
	deliverSuspendedSoftware: 'changedOnly',
	singleUserMode: 'boolean',
	proxyRemoteFiles: 'boolean',
	signToActivityPubGet: 'boolean',
	allowExternalApRedirect: 'boolean',
	enableRemoteNotesCleaning: 'boolean',
	remoteNotesCleaningMaxProcessingDurationInMinutes: 'number',
	remoteNotesCleaningExpiryDaysForEachNotes: 'number',
	showRoleBadgesOfRemoteUsers: 'boolean',
	clientOptions: 'changedOnly',
} as const satisfies Partial<Record<keyof MiMeta, Rule>>;

const policyFields = {
	gtlAvailable: 'boolean',
	ltlAvailable: 'boolean',
	canPublicNote: 'boolean',
	mentionLimit: 'number',
	canInvite: 'boolean',
	inviteLimit: 'number',
	inviteLimitCycle: 'number',
	inviteExpirationTime: 'number',
	canManageCustomEmojis: 'boolean',
	canManageAvatarDecorations: 'boolean',
	canSearchNotes: 'boolean',
	canSearchUsers: 'boolean',
	canUseTranslator: 'boolean',
	canHideAds: 'boolean',
	canCreateChannel: 'boolean',
	driveCapacityMb: 'number',
	maxFileSizeMb: 'number',
	alwaysMarkNsfw: 'boolean',
	canUpdateBioMedia: 'boolean',
	pinLimit: 'number',
	antennaLimit: 'number',
	wordMuteLimit: 'number',
	webhookLimit: 'number',
	clipLimit: 'number',
	noteEachClipsLimit: 'number',
	userListLimit: 'number',
	userEachUserListsLimit: 'number',
	rateLimitFactor: 'number',
	avatarDecorationLimit: 'number',
	canImportAntennas: 'boolean',
	canImportBlocking: 'boolean',
	canImportFollowing: 'boolean',
	canImportMuting: 'boolean',
	canImportUserLists: 'boolean',
	chatAvailability: 'changedOnly',
	uploadableFileTypes: 'changedOnly',
	noteDraftLimit: 'number',
	scheduledNoteLimit: 'number',
	watermarkAvailable: 'boolean',
} as const satisfies Partial<Record<keyof RolePolicies, Rule>>;

const fields: Record<string, Rule> = {
	...metaFields,
	// Legacy update-default-policies logs used policy names at the root.
	...policyFields,
	...Object.fromEntries(Object.entries(policyFields).map(([key, rule]) => [`policies.${key}`, rule])),
	'clientOptions.showTimelineForVisitor': 'boolean',
	'clientOptions.showActivitiesForVisitor': 'boolean',
	'clientOptions.entrancePageStyle': 'changedOnly',
	// Historical name of urlPreviewSummaryProxyUrl.
	summalyProxy: 'changedOnly',
};

export type ServerSettingsLog = {
	before: Record<string, boolean | number | null>;
	after: Record<string, boolean | number | null>;
	changedFields: string[];
};

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readField(snapshot: unknown, key: string): unknown {
	const source = record(snapshot);
	// Sanitized logs use flat paths; legacy snapshots use nested objects.
	if (Object.hasOwn(source, key)) return source[key];
	return key.split('.').reduce<unknown>((value, part) => {
		const object = record(value);
		return Object.hasOwn(object, part) ? object[part] : undefined;
	}, source);
}

/** Used at creation AND packing. Never mutate Meta or trust stored JSON. */
export function sanitizeServerSettingsLog(info: unknown): ServerSettingsLog {
	const source = record(info);
	const result: ServerSettingsLog = { before: {}, after: {}, changedFields: [] };
	const previouslyChanged = new Set(Array.isArray(source.changedFields) ? source.changedFields : []);
	for (const [key, rule] of Object.entries(fields)) {
		const before = readField(source.before, key);
		const after = readField(source.after, key);
		if (!previouslyChanged.has(key) && isDeepStrictEqual(before, after)) continue;
		result.changedFields.push(key);
		if (rule === 'changedOnly') continue;
		for (const [side, value] of [['before', before], ['after', after]] as const) {
			if (value === null || (rule === 'boolean' && typeof value === 'boolean') ||
				(rule === 'number' && typeof value === 'number' && Number.isFinite(value))) {
				result[side][key] = value;
			}
		}
	}
	return result;
}
