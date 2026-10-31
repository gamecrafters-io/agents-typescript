import {
  AssistantMessage,
  Run,
  Snapshot,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from '@gamecrafters/agents-core';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import * as z from 'zod';
import type {AgentState} from '../src/agents.js';
import {AgentEvaluator, type TestCase} from '../src/evaluation.js';

const query = new UserMessage({content: 'What is 2 + 3?'});
const messages = [
  new SystemMessage({content: 'You are a calculator.'}),
  query,
  new AssistantMessage({
    content: null,
    toolCalls: [
      {
        id: 'call_1',
        type: 'function',
        function: {name: 'add_numbers', arguments: '{"a": 2, "b": 3}'},
      },
    ],
  }),
  new ToolMessage({content: '"5"', toolCallId: 'call_1', name: 'add_numbers'}),
  new AssistantMessage({content: '2 + 3 = 5.'}),
];

const testCase: TestCase = {
  id: 'add',
  description: 'Add two numbers with the calculator tool.',
  userQuery: 'What is 2 + 3?',
  expectedTools: ['add_numbers'],
  maxSteps: 5,
};

/** Makes a completed agent run whose every step leaves the same state. */
function agentRun(stepIds: string[]): Run<AgentState> {
  const state: AgentState = {
    userQuery: 'What is 2 + 3?',
    instructions: 'You are a calculator.',
    messages,
    currentToolCalls: null,
    totalTokens: 40,
    sessionId: 'default',
  };
  const run = Run.create<AgentState>();
  for (const stepId of stepIds) {
    run.addSnapshot(Snapshot.create(state, z.object({}), stepId));
  }
  run.complete();
  return run;
}

describe('AgentEvaluator', () => {
  let evaluator: AgentEvaluator;

  beforeAll(() => {
    // Making the judge LLM needs a key; these evaluations never call it.
    vi.stubEnv('OPENAI_API_KEY', 'unused-test-key');
    evaluator = new AgentEvaluator();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('scores a single step by its tool calls', () => {
    const correct = evaluator.evaluateSingleStep(messages, ['add_numbers']);
    expect(correct.overallScore).toBe(1);
    expect(correct.feedback).toBe(
      'Selected tools: ["add_numbers"], Expected: ["add_numbers"]',
    );
    const wrong = evaluator.evaluateSingleStep(messages, ['multiply']);
    expect(wrong.overallScore).toBeCloseTo(1 / 3);
    const none = evaluator.evaluateSingleStep([query], ['add_numbers']);
    expect(none.overallScore).toBe(0);
    expect(none.feedback).toBe('No tool calls were made when expected');
  });

  it('scores a trajectory against the test case', () => {
    const run = agentRun([
      '__entry__',
      'message_prep',
      'llm_processor',
      'tool_executor',
      'llm_processor',
    ]);
    const result = evaluator.evaluateTrajectory(testCase, run);
    expect(result.overallScore).toBe(1);
    expect(result.taskCompletion.stepsTaken).toBe(4);
    expect(result.systemMetrics.costEstimate).toBeCloseTo(40 * 0.375e-6);

    const tooLong = evaluator.evaluateTrajectory(
      {...testCase, maxSteps: 3},
      run,
    );
    expect(tooLong.overallScore).toBe(0.75);
    const empty = evaluator.evaluateTrajectory(testCase, Run.create());
    expect(empty.feedback).toBe('No execution snapshots found');
  });
});
