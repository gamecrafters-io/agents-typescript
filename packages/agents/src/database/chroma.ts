/**
 * @fileoverview Vector stores on Chroma collections, embedded with OpenAI, and
 * a service that loads PDFs into them.
 *
 * Unlike Python's in-process `chromadb.Client()`, the JavaScript client talks
 * to a Chroma server, such as one started with `chroma run`.
 */

import {
  ChromaClient,
  ChromaNotFoundError,
  ChromaUniqueError,
  type Collection,
  type EmbeddingFunction,
  type GetResult,
  type Metadata,
  type QueryResult,
  type Where,
  type WhereDocument,
} from 'chromadb';
import {OpenAI} from 'openai';
import {Corpus, Document} from '../documents.js';
import {PDFLoader} from '../loaders.js';

/** Options for an `OpenAIEmbeddingFunction`. */
export interface OpenAIEmbeddingOptions {
  /** Defaults to the `OPENAI_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to `text-embedding-ada-002`, as in Chroma's Python client. */
  model?: string;
}

/** Embeds texts for a Chroma collection with OpenAI's embeddings API. */
export class OpenAIEmbeddingFunction implements EmbeddingFunction {
  readonly model: string;
  private readonly client: OpenAI;

  constructor({
    apiKey,
    model = 'text-embedding-ada-002',
  }: OpenAIEmbeddingOptions = {}) {
    this.model = model;
    this.client = new OpenAI({apiKey});
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

/** Options for `VectorStore.query`. */
export interface QueryOptions {
  /** The most results to return per query text. Defaults to 3. */
  nResults?: number;
  /** A metadata filter, such as `{category: 'technical'}`. */
  where?: Where;
  /** A document content filter, such as `{$contains: 'learning'}`. */
  whereDocument?: WhereDocument;
}

/** Options for `VectorStore.get`. */
export interface GetOptions {
  ids?: string[];
  where?: Where;
  limit?: number;
}

/** Documents in a Chroma collection, searchable by meaning. */
export class VectorStore {
  constructor(private readonly collection: Collection) {}

  /**
   * Adds a document, a corpus or a list of documents; the collection embeds
   * their contents. Throws a `TypeError` for anything else.
   */
  async add(item: Document | Corpus | readonly Document[]): Promise<void> {
    const {contents, metadatas, ids} = toCorpus(item).toDict();
    await this.collection.add({
      ids,
      documents: contents,
      // Chroma takes null for a record without metadata, and rejects values
      // it cannot store, so Document's looser metadata type is safe here.
      metadatas: metadatas.map((metadata) => metadata ?? null) as Metadata[],
    });
  }

  /** Finds the stored documents most similar to the query texts. */
  query(
    queryTexts: string | string[],
    {nResults = 3, where, whereDocument}: QueryOptions = {},
  ): Promise<QueryResult> {
    return this.collection.query({
      queryTexts: typeof queryTexts === 'string' ? [queryTexts] : queryTexts,
      nResults,
      where,
      whereDocument,
      include: ['documents', 'distances', 'metadatas'],
    });
  }

  /** Fetches documents by ID or metadata, without a similarity search. */
  get({ids, where, limit}: GetOptions = {}): Promise<GetResult> {
    // Distances exist only for queries, and Chroma rejects them here.
    return this.collection.get({
      ids,
      where,
      limit,
      include: ['documents', 'metadatas'],
    });
  }
}

/** Options for a `VectorStoreManager`. */
export interface VectorStoreManagerOptions {
  /** Defaults to the `OPENAI_API_KEY` environment variable. */
  openaiApiKey?: string;
  /** The Chroma server's client. Defaults to one for `localhost:8000`. */
  client?: ChromaClient;
}

/** Creates, finds and deletes vector stores on a Chroma server. */
export class VectorStoreManager {
  readonly chromaClient: ChromaClient;
  readonly embeddingFunction: EmbeddingFunction;

  constructor({
    openaiApiKey,
    client = new ChromaClient(),
  }: VectorStoreManagerOptions = {}) {
    this.chromaClient = client;
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      apiKey: openaiApiKey,
    });
  }

  /** Returns the named store, or undefined if it does not exist. */
  async getStore(name: string): Promise<VectorStore | undefined> {
    try {
      const collection = await this.chromaClient.getCollection({
        name,
        embeddingFunction: this.embeddingFunction,
      });
      return new VectorStore(collection);
    } catch (error) {
      if (error instanceof ChromaNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Creates a store, first deleting any store of that name when `force` is
   * set. Throws if the store exists and `force` is not set.
   */
  async createStore(
    storeName: string,
    {force = false}: {force?: boolean} = {},
  ): Promise<VectorStore> {
    if (force) {
      await this.deleteStore(storeName);
    }
    try {
      const collection = await this.chromaClient.createCollection({
        name: storeName,
        embeddingFunction: this.embeddingFunction,
      });
      return new VectorStore(collection);
    } catch (error) {
      if (error instanceof ChromaUniqueError) {
        throw new Error(
          `Store ${storeName} exists: pass {force: true} or use ` +
            'getOrCreateStore.',
          {cause: error},
        );
      }
      throw error;
    }
  }

  async getOrCreateStore(storeName: string): Promise<VectorStore> {
    const collection = await this.chromaClient.getOrCreateCollection({
      name: storeName,
      embeddingFunction: this.embeddingFunction,
    });
    return new VectorStore(collection);
  }

  /** Deletes a store if it exists. */
  async deleteStore(storeName: string): Promise<void> {
    try {
      await this.chromaClient.deleteCollection({name: storeName});
    } catch (error) {
      if (!(error instanceof ChromaNotFoundError)) {
        throw error;
      }
    }
  }
}

/** Loads files into vector stores. */
export class CorpusLoaderService {
  constructor(readonly manager: VectorStoreManager) {}

  /**
   * Loads a PDF into the named store, one document per page with text,
   * creating the store if needed, and returns the store.
   */
  async loadPdf(storeName: string, pdfPath: string): Promise<VectorStore> {
    const store = await this.manager.getOrCreateStore(storeName);
    await store.add(await new PDFLoader(pdfPath).load());
    return store;
  }
}

/** Turns what `VectorStore.add` accepts into a corpus. */
function toCorpus(item: Document | Corpus | readonly Document[]): Corpus {
  if (item instanceof Document) {
    return new Corpus([item]);
  }
  if (item instanceof Corpus) {
    return item;
  }
  // Callers without types can pass anything, so check what TypeScript cannot.
  if (Array.isArray(item)) {
    if (!item.every((document) => document instanceof Document)) {
      throw new TypeError('List must contain Document objects only.');
    }
    return new Corpus(item);
  }
  throw new TypeError('Item must be a Document, a Corpus or a list of them.');
}
