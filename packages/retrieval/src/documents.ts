/**
 * @fileoverview Documents, and a corpus that keeps them in order: the units
 * that loaders produce and vector stores index.
 */

import {randomUUID} from 'node:crypto';

/** Options for a `Document`. */
export interface DocumentOptions {
  /** Defaults to a random UUID. */
  id?: string;
  /** Defaults to an empty string. */
  content?: string;
  metadata?: Record<string, unknown>;
}

/** A piece of text, such as a PDF page, with an ID and optional metadata. */
export class Document {
  readonly id: string;
  readonly content: string;
  readonly metadata: Record<string, unknown> | undefined;

  constructor({
    id = randomUUID(),
    content = '',
    metadata,
  }: DocumentOptions = {}) {
    this.id = id;
    this.content = content;
    this.metadata = metadata;
  }
}

/** A corpus as parallel lists, the shape that vector store batches take. */
export interface CorpusDict {
  contents: string[];
  metadatas: Array<Record<string, unknown> | undefined>;
  ids: string[];
}

/**
 * An ordered list of documents. Negative indexes count from the end, and
 * adding anything but a `Document` throws a `TypeError`.
 */
export class Corpus implements Iterable<Document> {
  private readonly documents: Document[];

  constructor(documents: Iterable<Document> = []) {
    this.documents = [...documents].map((document) => checked(document));
  }

  get length(): number {
    return this.documents.length;
  }

  /** Returns the document at an index; throws a `RangeError` if none. */
  get(index: number): Document {
    return this.documents[this.position(index)];
  }

  /** Replaces the document at an index; throws a `RangeError` if none. */
  set(index: number, document: Document): void {
    this.documents[this.position(index)] = checked(document);
  }

  /** Removes the document at an index; throws a `RangeError` if none. */
  delete(index: number): void {
    this.documents.splice(this.position(index), 1);
  }

  /** Inserts a document before an index, clamped to the corpus's ends. */
  insert(index: number, document: Document): void {
    this.documents.splice(index, 0, checked(document));
  }

  append(document: Document): void {
    this.insert(this.documents.length, document);
  }

  extend(documents: Iterable<Document>): void {
    // Copy first, so that a corpus can extend itself.
    for (const document of [...documents]) {
      this.append(document);
    }
  }

  [Symbol.iterator](): Iterator<Document> {
    return this.documents[Symbol.iterator]();
  }

  /** Splits the corpus into parallel lists of contents, metadata and IDs. */
  toDict(): CorpusDict {
    return {
      contents: this.documents.map((document) => document.content),
      metadatas: this.documents.map((document) => document.metadata),
      ids: this.documents.map((document) => document.id),
    };
  }

  /** Turns a possibly negative index into a position, checking its range. */
  private position(index: number): number {
    const position = index < 0 ? index + this.documents.length : index;
    if (
      !Number.isInteger(position) ||
      position < 0 ||
      position >= this.documents.length
    ) {
      throw new RangeError(`Corpus index out of range: ${index}`);
    }
    return position;
  }
}

/** Returns the document, throwing a `TypeError` if it is not a `Document`. */
function checked(document: Document): Document {
  if (!(document instanceof Document)) {
    throw new TypeError('Collection only supports Document items');
  }
  return document;
}
