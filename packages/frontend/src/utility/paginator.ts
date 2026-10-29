/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, shallowRef, triggerRef } from 'vue';
import * as Misskey from 'misskey-js';
import type { ComputedRef, Ref, ShallowRef, UnwrapRef } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';

const MAX_ITEMS = 30;
const MAX_QUEUE_ITEMS = 100;
const FIRST_FETCH_LIMIT = 15;
const SECOND_FETCH_LIMIT = 30;

export type MisskeyEntity = {
	id: string;
	createdAt: string;
	_shouldInsertAd_?: boolean;
};

type AbsEndpointType = {
	req: unknown;
	res: unknown;
};

type FilterByEpRes<E extends Record<string, AbsEndpointType>> = {
	[K in keyof E]: E[K]['res'] extends Array<{ id: string }> ? K : never
}[keyof E];
export type PaginatorCompatibleEndpointPaths = FilterByEpRes<Misskey.Endpoints>;
export type PaginatorCompatibleEndpoints = {
	[K in PaginatorCompatibleEndpointPaths]: Misskey.Endpoints[K];
};

export type ExtractorFunction<P extends IPaginator, T> = (item: UnwrapRef<P['items']>[number]) => T;

export interface IPaginator<T = unknown, _T = T & MisskeyEntity> {
	/**
	 * 外部から直接操作しないでください
	 */
	items: Ref<_T[]> | ShallowRef<_T[]>;
	queuedAheadItemsCount: Ref<number>;
	fetching: Ref<boolean>;
	fetchingOlder: Ref<boolean>;
	fetchingNewer: Ref<boolean>;
	canFetchOlder: Ref<boolean>;
	canFetchNewer: Ref<boolean>;
	canSearch: boolean;
	error: Ref<boolean>;
	computedParams: ComputedRef<Misskey.Endpoints[PaginatorCompatibleEndpointPaths]['req'] | null | undefined> | null;
	initialId: MisskeyEntity['id'] | null;
	initialDate: number | null;
	initialDirection: 'newer' | 'older';
	noPaging: boolean;
	searchQuery: Ref<null | string>;
	order: Ref<'newest' | 'oldest'>;

	init(): Promise<void>;
	reload(): Promise<void>;
	fetchOlder(): Promise<void>;
	fetchNewer(options?: { toQueue?: boolean }): Promise<void>;
	trim(trigger?: boolean): void;
	unshiftItems(newItems: (_T)[]): void;
	pushItems(oldItems: (_T)[]): void;
	prepend(item: _T): void;
	enqueue(item: _T): void;
	releaseQueue(): void;
	removeItem(id: string): void;
	updateItem(id: string, updater: (item: _T) => _T): void;
	filterCachedItems?(): void;
	autoFetchPaused?: Ref<boolean>;
}

export class Paginator<
	Endpoint extends PaginatorCompatibleEndpointPaths,
	E extends PaginatorCompatibleEndpoints[Endpoint] = PaginatorCompatibleEndpoints[Endpoint],
	T extends E['res'][number] & MisskeyEntity = E['res'][number] & MisskeyEntity,
	SRef extends boolean = false,
> implements IPaginator {
	/**
	 * 外部から直接操作しないでください
	 */
	public items: SRef extends true ? ShallowRef<T[]> : Ref<T[]>;

	public queuedAheadItemsCount = ref(0);
	public fetching = ref(true);
	public fetchingOlder = ref(false);
	public fetchingNewer = ref(false);
	public canFetchOlder = ref(false);
	public canFetchNewer = ref(false);
	public canSearch = false;
	public error = ref(false);
	private endpoint: Endpoint;
	private limit: number;
	private params: E['req'] | (() => E['req']);
	public computedParams: ComputedRef<E['req'] | null | undefined> | null;
	public initialId: MisskeyEntity['id'] | null = null;
	public initialDate: number | null = null;

	// 初回読み込み時、initialIdを基準にそれより新しいものを取得するか古いものを取得するか
	// newer: initialIdより新しいものを取得する
	// older: initialIdより古いものを取得する (default)
	public initialDirection: 'newer' | 'older';

	private offsetMode: boolean;
	public noPaging: boolean;
	public searchQuery = ref<null | string>('');
	private searchParamName: keyof E['req'] | 'search';
	private canFetchDetection: 'safe' | 'limit' | null = null;
	private aheadQueue: T[] = [];
	private useShallowRef: SRef;
	private itemFilter?: (item: T) => boolean;
	private olderCursor: string | null = null;
	private newerCursor: string | null = null;
	private lastPageLength = { older: 0, newer: 0 };
	private initialization: Promise<void> | null = null;
	private initializationKey: string | null = null;
	private paging: Promise<void> | null = null;
	public autoFetchPaused = ref(false);

	// 配列内の要素をどのような順序で並べるか
	// newest: 新しいものが先頭 (default)
	// oldest: 古いものが先頭
	// NOTE: このようなプロパティを用意してこっち側で並びを管理せずに、Setで持っておき参照者側が好きに並び変えるような設計の方がすっきりしそうなものの、Vueのレンダリングのたびに並び替え処理が発生することになったりしそうでパフォーマンス上の懸念がある
	public order: Ref<'newest' | 'oldest'>;

	constructor(endpoint: Endpoint, props: {
		limit?: number;
		params?: E['req'] | (() => E['req']);
		computedParams?: ComputedRef<E['req'] | null | undefined>;

		/**
		 * 検索APIのような、ページング不可なエンドポイントを利用する場合
		 * (そのようなAPIをこの関数で使うのは若干矛盾してるけど)
		 */
		noPaging?: boolean;

		offsetMode?: boolean;

		initialId?: MisskeyEntity['id'];
		initialDate?: number | null;
		initialDirection?: 'newer' | 'older';

		order?: 'newest' | 'oldest';

		// 一部のAPIはさらに遡れる場合でもパフォーマンス上の理由でlimit以下の結果を返す場合があり、その場合はsafe、それ以外はlimitにすることを推奨
		canFetchDetection?: 'safe' | 'limit';

		useShallowRef?: SRef;

		canSearch?: boolean;
		searchParamName?: keyof E['req'];
		// Opt-in presentation filter; API cursors must include rejected items.
		itemFilter?: (item: T) => boolean;
	}) {
		this.endpoint = endpoint;
		this.useShallowRef = (props.useShallowRef ?? false) as SRef;
		if (this.useShallowRef) {
			this.items = shallowRef<T[]>([]);
		} else {
			this.items = ref<T[]>([]) as Ref<T[]>;
		}

		this.limit = props.limit ?? FIRST_FETCH_LIMIT;
		this.params = props.params ?? {};
		this.computedParams = props.computedParams ?? null;
		this.order = ref(props.order ?? 'newest');
		this.initialId = props.initialId ?? null;
		this.initialDate = props.initialDate ?? null;
		this.initialDirection = props.initialDirection ?? 'older';
		this.canFetchDetection = props.canFetchDetection ?? null;
		this.noPaging = props.noPaging ?? false;
		this.offsetMode = props.offsetMode ?? false;
		this.canSearch = props.canSearch ?? false;
		this.searchParamName = props.searchParamName ?? 'search';
		this.itemFilter = props.itemFilter;

		this.getNewestId = this.getNewestId.bind(this);
		this.getOldestId = this.getOldestId.bind(this);
		this.init = this.init.bind(this);
		this.reload = this.reload.bind(this);
		this.fetchOlder = this.fetchOlder.bind(this);
		this.fetchNewer = this.fetchNewer.bind(this);
		this.unshiftItems = this.unshiftItems.bind(this);
		this.pushItems = this.pushItems.bind(this);
		this.prepend = this.prepend.bind(this);
		this.enqueue = this.enqueue.bind(this);
		this.releaseQueue = this.releaseQueue.bind(this);
		this.removeItem = this.removeItem.bind(this);
		this.updateItem = this.updateItem.bind(this);
	}

	private getNewestId(): string | null | undefined {
		if (this.itemFilter && this.newerCursor) return this.newerCursor;
		// 様々な要因により並び順は保証されないのでソートが必要
		if (this.aheadQueue.length > 0) {
			return this.aheadQueue.map(x => x.id).sort().at(-1);
		}
		return this.items.value.map(x => x.id).sort().at(-1);
	}

	private getOldestId(): string | null | undefined {
		if (this.itemFilter && this.olderCursor) return this.olderCursor;
		// 様々な要因により並び順は保証されないのでソートが必要
		return this.items.value.map(x => x.id).sort().at(0);
	}

	public init(): Promise<void> {
		const key = JSON.stringify([
			typeof this.params === 'function' ? this.params() : this.params,
			this.computedParams?.value, this.searchQuery.value,
			this.initialId, this.initialDate, this.initialDirection,
		]);
		if (this.initialization) {
			// Repeated mount/retry calls share the request, but a changed filter
			// must load its latest query after the outstanding request settles.
			return key === this.initializationKey ? this.initialization : this.initialization.then(() => this.init());
		}
		this.initializationKey = key;
		const initialize = async () => {
			if (this.paging) await this.paging;
			await this.initialize();
		};
		this.initialization = initialize().finally(() => { this.initialization = null; });
		return this.initialization;
	}

	private async initialize(): Promise<void> {
		this.items.value = [];
		this.olderCursor = null;
		this.newerCursor = null;
		this.aheadQueue = [];
		this.queuedAheadItemsCount.value = 0;
		this.fetching.value = true;

		const data: E['req'] = {
			...(typeof this.params === 'function' ? this.params() : this.params),
			...(this.computedParams ? this.computedParams.value : {}),
			...(this.searchQuery.value != null && this.searchQuery.value.trim() !== '' ? { [this.searchParamName]: this.searchQuery.value } : {}),
			limit: this.limit ?? FIRST_FETCH_LIMIT,
			allowPartial: true,
			...((this.initialId == null && this.initialDate == null) && this.initialDirection === 'newer' ? {
				sinceId: '0',
			} : this.initialDirection === 'newer' ? {
				sinceId: this.initialId ?? undefined,
				sinceDate: this.initialDate ?? undefined,
			} : (this.initialId || this.initialDate) && this.initialDirection === 'older' ? {
				untilId: this.initialId ?? undefined,
				untilDate: this.initialDate ?? undefined,
			} : {}),
		};

		const apiRes = (await this.fetchPage(data, this.initialDirection).catch(_ => {
			this.error.value = true;
			this.fetching.value = false;
			return null;
		})) as T[] | null;

		if (apiRes == null) {
			return;
		}

		// 逆順で返ってくるので
		if ((this.initialId || this.initialDate) && this.initialDirection === 'newer') {
			apiRes.reverse();
		}

		for (let i = 0; i < apiRes.length; i++) {
			const item = apiRes[i];
			if (i === 3) item._shouldInsertAd_ = true;
		}

		this.pushItems(apiRes);

		if (this.canFetchDetection === 'limit') {
			if (this.lastPageLength[this.initialDirection] < FIRST_FETCH_LIMIT) {
				(this.initialDirection === 'older' ? this.canFetchOlder : this.canFetchNewer).value = false;
			} else {
				(this.initialDirection === 'older' ? this.canFetchOlder : this.canFetchNewer).value = true;
			}
		} else if (this.canFetchDetection === 'safe' || this.canFetchDetection == null) {
			if (this.lastPageLength[this.initialDirection] === 0 || this.noPaging) {
				(this.initialDirection === 'older' ? this.canFetchOlder : this.canFetchNewer).value = false;
			} else {
				(this.initialDirection === 'older' ? this.canFetchOlder : this.canFetchNewer).value = true;
			}
		}

		this.error.value = false;
		this.fetching.value = false;
	}

	public reload(): Promise<void> {
		return this.init();
	}

	public fetchOlder(): Promise<void> {
		if (this.paging || this.initialization) return Promise.resolve();
		this.paging = this.fetchOlderPage().finally(() => { this.paging = null; });
		return this.paging;
	}

	private async fetchOlderPage(): Promise<void> {
		if (!this.canFetchOlder.value || this.fetching.value || this.fetchingOlder.value || this.fetchingNewer.value || (!this.items.value.length && !this.olderCursor)) return;
		this.fetchingOlder.value = true;

		const data: E['req'] = {
			...(typeof this.params === 'function' ? this.params() : this.params),
			...(this.computedParams ? this.computedParams.value : {}),
			...(this.searchQuery.value != null && this.searchQuery.value.trim() !== '' ? { [this.searchParamName]: this.searchQuery.value } : {}),
			limit: SECOND_FETCH_LIMIT,
			...(this.offsetMode ? {
				offset: this.items.value.length,
			} : {
				untilId: this.getOldestId(),
			}),
		};

		const apiRes = (await this.fetchPage(data, 'older').catch(_ => {
			if (this.itemFilter) this.autoFetchPaused.value = true;
			return null;
		})) as T[] | null;

		this.fetchingOlder.value = false;

		if (apiRes == null) {
			return;
		}

		for (let i = 0; i < apiRes.length; i++) {
			const item = apiRes[i];
			if (i === 10) item._shouldInsertAd_ = true;
		}

		if (this.order.value === 'oldest') {
			this.unshiftItems(apiRes.toReversed(), false);
		} else {
			this.pushItems(apiRes);
		}

		if (this.canFetchDetection === 'limit') {
			if (this.lastPageLength.older < FIRST_FETCH_LIMIT) {
				this.canFetchOlder.value = false;
			} else {
				this.canFetchOlder.value = true;
			}
		} else if (this.canFetchDetection === 'safe' || this.canFetchDetection == null) {
			if (this.lastPageLength.older === 0) {
				this.canFetchOlder.value = false;
			} else {
				this.canFetchOlder.value = true;
			}
		}
	}

	public fetchNewer(options: {
		toQueue?: boolean;
	} = {}): Promise<void> {
		if (this.paging || this.initialization) return Promise.resolve();
		this.paging = this.fetchNewerPage(options).finally(() => { this.paging = null; });
		return this.paging;
	}

	private async fetchNewerPage(options: { toQueue?: boolean }): Promise<void> {
		if (this.fetching.value || this.fetchingNewer.value || this.fetchingOlder.value) return;
		this.fetchingNewer.value = true;

		const data: E['req'] = {
			...(typeof this.params === 'function' ? this.params() : this.params),
			...(this.computedParams ? this.computedParams.value : {}),
			...(this.searchQuery.value != null && this.searchQuery.value.trim() !== '' ? { [this.searchParamName]: this.searchQuery.value } : {}),
			limit: SECOND_FETCH_LIMIT,
			...(this.offsetMode ? {
				offset: this.items.value.length,
			} : {
				sinceId: this.getNewestId(),
			}),
		};

		const apiRes = (await this.fetchPage(data, 'newer').catch(_ => {
			return null;
		})) as T[] | null;

		this.fetchingNewer.value = false;

		if (apiRes == null || this.lastPageLength.newer === 0) {
			this.canFetchNewer.value = false;
			// 余計なre-renderを防止するためここで終了
			if (apiRes == null || apiRes.length === 0) return;
		}

		if (options.toQueue) {
			this.aheadQueue.unshift(...apiRes.filter(x => !this.itemFilter || this.itemFilter(x)).toReversed());
			if (this.aheadQueue.length > MAX_QUEUE_ITEMS) {
				this.aheadQueue = this.aheadQueue.slice(0, MAX_QUEUE_ITEMS);
			}
			this.queuedAheadItemsCount.value = this.aheadQueue.length;
		} else {
			if (this.order.value === 'oldest') {
				this.pushItems(apiRes);
			} else {
				this.unshiftItems(apiRes.toReversed(), false);
			}
		}

		if (this.canFetchDetection === 'limit') {
			if (this.lastPageLength.newer < FIRST_FETCH_LIMIT) {
				this.canFetchNewer.value = false;
			} else {
				this.canFetchNewer.value = true;
			}
		}
		// canFetchDetectionが'safe'の場合・apiRes.length === 0 の場合は apiRes.length === 0 の場合に canFetchNewer.value = false になるが、
		// 余計な re-render を防ぐために上部で処理している。そのため、ここでは何もしない
	}

	public trim(trigger = true): void {
		const dropped = this.items.value.length > MAX_ITEMS;
		if (this.items.value.length >= MAX_ITEMS) this.canFetchOlder.value = true;
		this.items.value = this.items.value.slice(0, MAX_ITEMS);
		if (dropped && this.itemFilter) this.olderCursor = this.items.value.map(x => x.id).sort().at(0) ?? null;
		if (this.useShallowRef && trigger) triggerRef(this.items);
	}

	public unshiftItems(newItems: T[], trim = true): void {
		if (this.itemFilter) newItems = newItems.filter(this.itemFilter);
		if (newItems.length === 0) return; // これやらないと余計なre-renderが走る
		this.items.value.unshift(...newItems.filter(x => !this.items.value.some(y => y.id === x.id))); // ストリーミングやポーリングのタイミングによっては重複することがあるため
		if (trim) this.trim(true);
		if (this.useShallowRef) triggerRef(this.items);
	}

	public pushItems(oldItems: T[]): void {
		if (this.itemFilter) oldItems = oldItems.filter(this.itemFilter);
		if (oldItems.length === 0) return; // これやらないと余計なre-renderが走る
		this.items.value.push(...oldItems);
		if (this.useShallowRef) triggerRef(this.items);
	}

	public prepend(item: T): void {
		if (this.itemFilter && !this.itemFilter(item)) return;
		if (this.items.value.some(x => x.id === item.id)) return;
		this.items.value.unshift(item);
		this.trim(false);
		if (this.useShallowRef) triggerRef(this.items);
	}

	public enqueue(item: T): void {
		if (this.itemFilter && !this.itemFilter(item)) return;
		this.aheadQueue.unshift(item);
		if (this.aheadQueue.length > MAX_QUEUE_ITEMS) {
			this.aheadQueue.pop();
		}
		this.queuedAheadItemsCount.value = this.aheadQueue.length;
	}

	public releaseQueue(): void {
		if (this.aheadQueue.length === 0) return; // これやらないと余計なre-renderが走る
		this.unshiftItems(this.aheadQueue);
		this.aheadQueue = [];
		this.queuedAheadItemsCount.value = 0;
	}

	public removeItem(id: string): void {
		// TODO: queueからも消す

		const index = this.items.value.findIndex(x => x.id === id);
		if (index !== -1) {
			this.items.value.splice(index, 1);
			if (this.useShallowRef) triggerRef(this.items);
		}
	}

	public updateItem(id: string, updater: (item: T) => T): void {
		// TODO: queueのも更新

		const index = this.items.value.findIndex(x => x.id === id);
		if (index !== -1) {
			const item = this.items.value[index]!;
			this.items.value[index] = updater(item);
			this.filterCachedItems();
			if (this.useShallowRef) triggerRef(this.items);
		}
	}

	public filterCachedItems(): void {
		if (!this.itemFilter) return;
		this.rememberCursors(this.items.value);
		this.items.value = this.items.value.filter(this.itemFilter);
		if (!this.items.value.length && this.canFetchOlder.value) this.autoFetchPaused.value = true;
		this.aheadQueue = this.aheadQueue.filter(this.itemFilter);
		this.queuedAheadItemsCount.value = this.aheadQueue.length;
	}

	private rememberCursors(items: T[]): void {
		if (!this.itemFilter || !items.length) return;
		const ids = items.map(x => x.id).sort();
		this.olderCursor = [this.olderCursor ?? ids[0], ids[0]].sort()[0];
		this.newerCursor = [this.newerCursor ?? ids[ids.length - 1], ids[ids.length - 1]].sort().at(-1)!;
	}

	private async fetchPage(data: E['req'], direction: 'older' | 'newer'): Promise<T[]> {
		if (direction === 'older') this.autoFetchPaused.value = false;
		const collected: T[] = [];
		const query = { ...data } as E['req'] & { untilId?: string; sinceId?: string; offset?: number };
		// A sparse feed must make progress, but never scan indefinitely in one action.
		for (let page = 0; page < (this.itemFilter ? 5 : 1); page++) {
			const items = await misskeyApi<T[]>(this.endpoint, query);
			this.lastPageLength[direction] = items.length;
			this.rememberCursors(items);
			collected.push(...items);
			if (!this.itemFilter || items.some(this.itemFilter) || !items.length || this.noPaging) break;
			const cursor = direction === 'older' ? this.olderCursor : this.newerCursor;
			const key = direction === 'older' ? 'untilId' : 'sinceId';
			if (this.offsetMode) query.offset = (query.offset ?? 0) + items.length;
			else {
				// A repeated page cannot advance this cursor. Leave continuation manual.
				if (!cursor || query[key] === cursor) {
					if (direction === 'older') this.autoFetchPaused.value = true;
					break;
				}
				query[key] = cursor;
			}
			if (page === 4 && direction === 'older') this.autoFetchPaused.value = true;
		}
		return collected;
	}
}
