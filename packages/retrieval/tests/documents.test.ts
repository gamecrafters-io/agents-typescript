import {describe, expect, it} from 'vitest';
import {Corpus, Document} from '../src/documents.js';

function ids(corpus: Corpus): string[] {
  return [...corpus].map((document) => document.id);
}

describe('Document', () => {
  it('has a random ID and empty content by default', () => {
    const document = new Document();
    expect(document.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(document.content).toBe('');
    expect(document.metadata).toBeUndefined();
  });
});

describe('Corpus', () => {
  it('indexes from either end and edits in place', () => {
    const corpus = new Corpus([
      new Document({id: 'a'}),
      new Document({id: 'b'}),
    ]);
    corpus.append(new Document({id: 'd'}));
    corpus.insert(-1, new Document({id: 'c'}));
    expect(ids(corpus)).toEqual(['a', 'b', 'c', 'd']);
    expect(corpus.get(-1).id).toBe('d');
    corpus.set(0, new Document({id: 'z'}));
    corpus.delete(1);
    expect(ids(corpus)).toEqual(['z', 'c', 'd']);
    expect(corpus.length).toBe(3);
    expect(() => corpus.get(3)).toThrow(RangeError);
  });

  it('copies the documents it starts with and can extend itself', () => {
    const documents = [new Document({id: 'a'})];
    const corpus = new Corpus(documents);
    documents.push(new Document({id: 'b'}));
    corpus.extend(corpus);
    expect(ids(corpus)).toEqual(['a', 'a']);
  });

  it('accepts only documents', () => {
    const lookalike = {id: 'x', content: 'x', metadata: undefined};
    expect(() => new Corpus().append(lookalike)).toThrow(TypeError);
  });

  it('splits into parallel lists', () => {
    const corpus = new Corpus([
      new Document({id: 'a', content: 'A', metadata: {page: 1}}),
      new Document({id: 'b', content: 'B'}),
    ]);
    expect(corpus.toDict()).toEqual({
      contents: ['A', 'B'],
      metadatas: [{page: 1}, undefined],
      ids: ['a', 'b'],
    });
    expect(new Corpus().toDict()).toEqual({
      contents: [],
      metadatas: [],
      ids: [],
    });
  });
});
