/**
 * @fileoverview Retrieval-augmented generation: find the documents closest to
 * a question, put them in the prompt, and have an LLM answer from them.
 */

import {
  EntryPoint,
  LLM,
  StateMachine,
  Step,
  SystemMessage,
  Termination,
  UserMessage,
  type AnyMessage,
  type Resource,
  type Run,
} from '@gamecrafters/agents-core';
import * as z from 'zod';
import {VectorStore} from './database/chroma.js';

const RAG_STATE_SCHEMA = z.object({
  messages: z.array(z.custom<AnyMessage>()),
  question: z.string(),
  documents: z.array(z.string()),
  distances: z.array(z.number()),
  answer: z.string(),
});

/** The state a RAG run carries from step to step. */
export type RAGState = z.infer<typeof RAG_STATE_SCHEMA>;

/**
 * Answers questions from a vector store's documents. Each `invoke` runs a
 * state machine that retrieves, augments and generates; the run's resource
 * holds the LLM and the vector store.
 */
export class RAG {
  readonly workflow = createStateMachine();
  readonly resource: Resource;

  constructor(llm: LLM, vectorStore: VectorStore) {
    this.resource = {vars: {llm, vectorStore}};
  }

  /** Answers the question; the final state holds the answer. */
  invoke(query: string): Promise<Run<RAGState>> {
    return this.workflow.run(
      {messages: [], question: query, documents: [], distances: [], answer: ''},
      this.resource,
    );
  }
}

async function retrieve(
  state: RAGState,
  resource: Resource | undefined,
): Promise<Partial<RAGState>> {
  const vectorStore = resource?.vars.vectorStore;
  if (!(vectorStore instanceof VectorStore)) {
    throw new Error('The RAG resource has no vector store.');
  }
  const [rows = []] = (await vectorStore.query(state.question)).rows();
  const documents: string[] = [];
  const distances: number[] = [];
  for (const {document, distance} of rows) {
    if (document != null && distance != null) {
      documents.push(document);
      distances.push(distance);
    }
  }
  return {documents, distances};
}

function augment(state: RAGState): Partial<RAGState> {
  const context = state.documents.join('\n\n');
  return {
    messages: [
      new SystemMessage({
        content: 'You are an assistant for question-answering tasks.',
      }),
      new UserMessage({
        content:
          'Use the following pieces of retrieved context to answer the ' +
          "question. If you don't know the answer, just say that you don't " +
          `know. \n# Question: \n-> ${state.question} ` +
          `\n# Context: \n-> ${context} ` +
          '\n# Answer: ',
      }),
    ],
  };
}

async function generate(
  state: RAGState,
  resource: Resource | undefined,
): Promise<Partial<RAGState>> {
  const llm = resource?.vars.llm;
  if (!(llm instanceof LLM)) {
    throw new Error('The RAG resource has no LLM.');
  }
  const reply = await llm.invoke(state.messages);
  return {answer: reply.content ?? '', messages: [...state.messages, reply]};
}

function createStateMachine(): StateMachine<RAGState> {
  const machine = new StateMachine<RAGState>(RAG_STATE_SCHEMA);
  const entry = new EntryPoint<RAGState>();
  const retrieveStep = new Step<RAGState>('retrieve', retrieve);
  const augmentStep = new Step<RAGState>('augment', augment);
  const generateStep = new Step<RAGState>('generate', generate);
  const termination = new Termination<RAGState>();
  machine.addSteps([
    entry,
    retrieveStep,
    augmentStep,
    generateStep,
    termination,
  ]);
  machine.connect(entry, retrieveStep);
  machine.connect(retrieveStep, augmentStep);
  machine.connect(augmentStep, generateStep);
  machine.connect(generateStep, termination);
  return machine;
}
