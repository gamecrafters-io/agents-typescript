/**
 * @fileoverview Long-term memory: users' facts and preferences kept in a
 * vector store and found by meaning.
 */

import type {Where} from 'chromadb';
import {Document} from './documents.js';
import type {VectorStore, VectorStoreManager} from './database/chroma.js';

const DEFAULT_NAMESPACE = 'default';

/** Options for a `MemoryFragment`. */
export interface MemoryFragmentOptions {
  content: string;
  /** The user the memory belongs to. */
  owner: string;
  /** Groups related memories. Defaults to `default`. */
  namespace?: string;
  /** Unix time in seconds. Defaults to now. */
  timestamp?: number;
}

/** A fact, preference or other memory that belongs to one user. */
export class MemoryFragment {
  readonly content: string;
  readonly owner: string;
  readonly namespace: string;
  /** Unix time in seconds. */
  readonly timestamp: number;

  constructor({
    content,
    owner,
    namespace = DEFAULT_NAMESPACE,
    timestamp = Math.floor(Date.now() / 1000),
  }: MemoryFragmentOptions) {
    this.content = content;
    this.owner = owner;
    this.namespace = namespace;
    this.timestamp = timestamp;
  }
}

/** The fragments a search found, with their distances from the query. */
export interface MemorySearchResult {
  fragments: MemoryFragment[];
  metadata: {distances: Array<number | null>};
}

/** Limits a search to memories created after and before Unix times. */
export interface TimestampFilter {
  greaterThanValue?: number;
  lowerThanValue?: number;
}

/** Options for `LongTermMemory.search`. */
export interface MemorySearchOptions {
  /** The most fragments to return. Defaults to 3. */
  limit?: number;
  timestampFilter?: TimestampFilter;
  /** Defaults to `default`. */
  namespace?: string;
}

/**
 * Users' memories in a vector store, kept apart by owner and namespace and
 * found by meaning.
 */
export class LongTermMemory {
  private constructor(readonly vectorStore: VectorStore) {}

  /**
   * Makes a long-term memory on a new `long_term_memory` store, replacing any
   * store of that name.
   */
  static async create(db: VectorStoreManager): Promise<LongTermMemory> {
    const store = await db.createStore('long_term_memory', {force: true});
    return new LongTermMemory(store);
  }

  /** Returns the distinct namespaces of the stored memories. */
  async getNamespaces(): Promise<string[]> {
    const {metadatas} = await this.vectorStore.get();
    const namespaces = new Set<string>();
    for (const metadata of metadatas) {
      if (typeof metadata?.namespace === 'string') {
        namespaces.add(metadata.namespace);
      }
    }
    return [...namespaces];
  }

  /** Stores a fragment, with any extra metadata to filter by. */
  async register(
    memoryFragment: MemoryFragment,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    await this.vectorStore.add(
      new Document({
        content: memoryFragment.content,
        metadata: {
          owner: memoryFragment.owner,
          namespace: memoryFragment.namespace,
          timestamp: memoryFragment.timestamp,
          ...metadata,
        },
      }),
    );
  }

  /**
   * Finds the owner's memories in a namespace that are closest in meaning to
   * the query, optionally within a time range.
   */
  async search(
    queryText: string,
    owner: string,
    {
      limit = 3,
      timestampFilter,
      namespace = DEFAULT_NAMESPACE,
    }: MemorySearchOptions = {},
  ): Promise<MemorySearchResult> {
    const conditions: Where[] = [
      {namespace: {$eq: namespace}},
      {owner: {$eq: owner}},
    ];
    const {greaterThanValue, lowerThanValue} = timestampFilter ?? {};
    if (greaterThanValue !== undefined) {
      conditions.push({timestamp: {$gt: greaterThanValue}});
    }
    if (lowerThanValue !== undefined) {
      conditions.push({timestamp: {$lt: lowerThanValue}});
    }
    const result = await this.vectorStore.query(queryText, {
      nResults: limit,
      where: {$and: conditions},
    });
    const [rows = []] = result.rows();
    const fragments = rows.map(
      ({document, metadata}) =>
        new MemoryFragment({
          content: document ?? '',
          owner: typeof metadata?.owner === 'string' ? metadata.owner : owner,
          namespace:
            typeof metadata?.namespace === 'string'
              ? metadata.namespace
              : DEFAULT_NAMESPACE,
          timestamp:
            typeof metadata?.timestamp === 'number'
              ? metadata.timestamp
              : undefined,
        }),
    );
    return {fragments, metadata: {distances: result.distances[0] ?? []}};
  }
}
