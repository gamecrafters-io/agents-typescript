/**
 * @fileoverview Loaders that turn files into corpora. `PDFLoader` reads a PDF
 * with Mozilla's PDF.js, one document per page.
 */

import {readFile} from 'node:fs/promises';
import {getDocument, VerbosityLevel} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {Corpus, Document} from './documents.js';

/** Loads a PDF's text, one document per page. */
export class PDFLoader {
  constructor(readonly pdfPath: string) {}

  /**
   * Returns a corpus with a document for each page that has text, whose ID is
   * the page number counting from 1. Pages with only whitespace are skipped.
   */
  async load(): Promise<Corpus> {
    const data = new Uint8Array(await readFile(this.pdfPath));
    // Report errors only, not warnings about fonts and the like.
    const task = getDocument({data, verbosity: VerbosityLevel.ERRORS});
    try {
      const pdf = await task.promise;
      const corpus = new Corpus();
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const {items} = await page.getTextContent();
        const text = items
          .map((item) =>
            'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '',
          )
          .join('');
        if (text.trim() !== '') {
          corpus.append(new Document({id: String(pageNumber), content: text}));
        }
      }
      return corpus;
    } finally {
      await task.destroy();
    }
  }
}
