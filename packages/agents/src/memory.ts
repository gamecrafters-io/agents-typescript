/**
 * @fileoverview Agent memory. Short-term memory keeps lists of objects, such
 * as agent runs, per session; it stores the objects themselves, not copies.
 * Long-term memory keeps users' facts and preferences in a vector store and
 * finds them by meaning.
 */

import type {Where} from 'chromadb';
import {Document} from './documents.js';
import type {VectorStore, VectorStoreManager} from './database/chroma.js';

const DEFAULT_SESSION = 'default';
const DEFAULT_NAMESPACE = 'default';

/** Thrown when a session does not exist. */
export class SessionNotFoundError extends Error {
  override name = 'SessionNotFoundError';

  constructor(sessionId: string) {
    super(`Session '${sessionId}' not found`);
  }
}

/**
 * The history of objects in each session. A `default` session always exists,
 * and methods without a session ID use it.
 */
export class ShortTermMemory<T = unknown> {
  readonly sessions = new Map<string, T[]>([[DEFAULT_SESSION, []]]);

  toString(): string {
    return `Memory(sessions=${JSON.stringify(this.getAllSessions())})`;
  }

  /** Creates a session; returns false if it already exists. */
  createSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      return false;
    }
    this.sessions.set(sessionId, []);
    return true;
  }

  /**
   * Deletes a session; returns false if it does not exist. Throws if asked to
   * delete the default session.
   */
  deleteSession(sessionId: string): boolean {
    if (sessionId === DEFAULT_SESSION) {
      throw new Error('Cannot delete the default session');
    }
    return this.sessions.delete(sessionId);
  }

  /** Adds an object to a session's history. */
  add(object: T, sessionId = DEFAULT_SESSION): void {
    this.objectsIn(sessionId).push(object);
  }

  /** Returns a session's objects, oldest first. */
  getAllObjects(sessionId = DEFAULT_SESSION): T[] {
    return [...this.objectsIn(sessionId)];
  }

  /** Returns a session's newest object, or undefined if it has none. */
  getLastObject(sessionId = DEFAULT_SESSION): T | undefined {
    return this.objectsIn(sessionId).at(-1);
  }

  getAllSessions(): string[] {
    return [...this.sessions.keys()];
  }

  /** Empties one session, or every session when none is given. */
  reset(sessionId?: string): void {
    if (sessionId === undefined) {
      for (const id of this.sessions.keys()) {
        this.sessions.set(id, []);
      }
      return;
    }
    this.objectsIn(sessionId);
    this.sessions.set(sessionId, []);
  }

  /** Removes and returns a session's newest object, if it has one. */
  pop(sessionId = DEFAULT_SESSION): T | undefined {
    return this.objectsIn(sessionId).pop();
  }

  /** Returns a session's list, throwing `SessionNotFoundError` if none. */
  private objectsIn(sessionId: string): T[] {
    const objects = this.sessions.get(sessionId);
    if (objects === undefined) {
      throw new SessionNotFoundError(sessionId);
    }
    return objects;
  }
}

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
