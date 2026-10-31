/**
 * @fileoverview Evaluates agents three ways: an LLM judges a final response,
 * a single step's tool calls are checked against the expected tools, and a
 * whole run's trajectory is scored.
 */

import {
  AssistantMessage,
  LLM,
  ZodOutputParser,
  type BaseMessage,
  type Run,
} from '@gamecrafters/agents-core';
import {zodResponseFormat} from 'openai/helpers/zod';
import * as z from 'zod';
import type {AgentState} from './agents.js';

/** Whether, and in how many steps, the agent completed the task. */
export interface TaskCompletionMetrics {
  /** Whether the task was completed successfully. */
  taskCompleted: boolean;
  /** The number of steps taken to complete the task. */
  stepsTaken: number;
  /** The expected number of steps, if known. */
  expectedSteps?: number;
}

/** Whether the output had the right format and followed instructions. */
export interface QualityControlMetrics {
  /** Whether the output format is correct. */
  formatCorrect: boolean;
  /** Whether the prompt's instructions were followed. */
  instructionsFollowed: boolean;
}

/** How well the agent used its tools. */
export interface ToolInteractionMetrics {
  /** Whether the right tool was chosen. */
  correctToolSelected: boolean;
  /** Whether the tool arguments were valid. */
  validArguments: boolean;
  /** Whether the tool returned useful results. */
  toolResultUseful: boolean;
}

/** System performance metrics. */
export interface SystemMetrics {
  /** Total tokens used. */
  totalTokens: number;
  /** Total execution time in seconds. */
  executionTime: number;
  /** Average tool call latency in seconds. */
  toolCallLatency: number;
  /** Memory usage, if tracked. */
  memoryUsage?: number;
  /** Estimated cost in US dollars. */
  costEstimate?: number;
}

/** A complete evaluation of an agent's work. */
export interface EvaluationResult {
  taskCompletion: TaskCompletionMetrics;
  qualityControl: QualityControlMetrics;
  toolInteraction: ToolInteractionMetrics;
  systemMetrics: SystemMetrics;
  /** The overall score, from 0 to 1. */
  overallScore: number;
  /** Detailed feedback and recommendations. */
  feedback: string;
}

/** A test case for evaluating an agent. */
export interface TestCase {
  id: string;
  description: string;
  userQuery: string;
  /** Names of the tools the agent should call. */
  expectedTools: string[];
  referenceAnswer?: string;
  maxSteps?: number;
  context?: Record<string, unknown>;
}

const JUDGE_EVALUATION_SCHEMA = z
  .object({
    taskCompleted: z
      .boolean()
      .describe('Whether the task was completed successfully'),
    formatCorrect: z.boolean().describe('Whether output format is correct'),
    instructionsFollowed: z
      .boolean()
      .describe('Whether prompt instructions were followed'),
    explanation: z.string().describe('Brief explanation of the evaluation'),
  })
  .describe('Structured evaluation from LLM judge');

/** An LLM judge's structured evaluation of a response. */
export type JudgeEvaluation = z.infer<typeof JUDGE_EVALUATION_SCHEMA>;

// The Python library's fallback keywords, which suit its video game examples.
const FALLBACK_KEYWORDS = [
  'zelda',
  'breath of the wild',
  'score',
  '98',
  'best',
];

/** Evaluates an agent's responses, single steps and whole runs. */
export class AgentEvaluator {
  readonly llmJudge = new LLM({model: 'gpt-4o-mini'});

  /**
   * Has the LLM judge evaluate the agent's final response, without looking
   * at how the agent got there. If the judge's reply cannot be parsed, as
   * when it refuses, a keyword heuristic stands in.
   */
  async evaluateFinalResponse(
    testCase: TestCase,
    agentResponse: string,
    executionTime: number,
    totalTokens: number,
  ): Promise<EvaluationResult> {
    const judgePrompt = [
      'Evaluate this agent response for the given task:',
      '',
      `Task: ${testCase.description}`,
      `User Query: ${testCase.userQuery}`,
      `Agent Response: ${agentResponse}`,
      `Reference Answer: ${
        testCase.referenceAnswer || 'No reference provided'
      }`,
      '',
      'Rate the response on:',
      '1. Task completion: Did it fully answer the query?',
      '2. Format correctness: Is the format appropriate?',
      '3. Instruction following: Did it follow implicit instructions?',
      '',
      'Provide your evaluation with a brief explanation.',
    ].join('\n');
    const judgeResponse = await this.llmJudge.invoke(
      judgePrompt,
      zodResponseFormat(JUDGE_EVALUATION_SCHEMA, 'JudgeEvaluation'),
    );

    let evaluation: JudgeEvaluation;
    try {
      evaluation = new ZodOutputParser(JUDGE_EVALUATION_SCHEMA).parse(
        judgeResponse,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`Debug: Structured parsing error: ${reason}`);
      console.log(`Debug: Judge response content: ${judgeResponse.content}`);
      const response = agentResponse.toLowerCase();
      const hasGameInfo = FALLBACK_KEYWORDS.some((keyword) =>
        response.includes(keyword),
      );
      evaluation = {
        taskCompleted: hasGameInfo,
        formatCorrect: agentResponse.trim().length > 0,
        instructionsFollowed: hasGameInfo,
        explanation: `Fallback evaluation due to parsing error: ${reason}`,
      };
    }

    return {
      taskCompletion: {
        taskCompleted: evaluation.taskCompleted,
        // The steps behind a final response are not tracked.
        stepsTaken: 1,
        expectedSteps: testCase.maxSteps,
      },
      qualityControl: {
        formatCorrect: evaluation.formatCorrect,
        instructionsFollowed: evaluation.instructionsFollowed,
      },
      // A final response shows nothing of tool use, so assume it went well.
      toolInteraction: {
        correctToolSelected: true,
        validArguments: true,
        toolResultUseful: evaluation.taskCompleted,
      },
      systemMetrics: {
        totalTokens,
        executionTime,
        toolCallLatency: 0,
        costEstimate: estimateCost(totalTokens),
      },
      overallScore: scoreOf([
        evaluation.taskCompleted,
        evaluation.formatCorrect,
        evaluation.instructionsFollowed,
      ]),
      feedback: evaluation.explanation,
    };
  }

  /**
   * Evaluates one decision: whether the last assistant message with tool
   * calls called an expected tool with arguments that parse as JSON.
   */
  evaluateSingleStep(
    agentMessages: readonly BaseMessage[],
    expectedToolCalls: readonly string[],
  ): EvaluationResult {
    const lastCalling = agentMessages.findLast(
      (message): message is AssistantMessage => toolNames(message).length > 0,
    );

    let toolInteraction: ToolInteractionMetrics;
    let overallScore: number;
    let feedback: string;
    if (lastCalling === undefined) {
      toolInteraction = {
        correctToolSelected: false,
        validArguments: false,
        toolResultUseful: false,
      };
      overallScore = 0;
      feedback = 'No tool calls were made when expected';
    } else {
      const actualTools = toolNames(lastCalling);
      const correctToolSelected = actualTools.some((name) =>
        expectedToolCalls.includes(name),
      );
      const validArguments = (lastCalling.toolCalls ?? []).every((call) =>
        isJson(call.function.arguments),
      );
      // Assume a correct tool's result is useful.
      toolInteraction = {
        correctToolSelected,
        validArguments,
        toolResultUseful: correctToolSelected,
      };
      overallScore = scoreOf([
        correctToolSelected,
        validArguments,
        correctToolSelected,
      ]);
      feedback =
        `Selected tools: ${JSON.stringify(actualTools)}, ` +
        `Expected: ${JSON.stringify(expectedToolCalls)}`;
    }

    return {
      taskCompletion: {
        taskCompleted: toolInteraction.correctToolSelected,
        stepsTaken: 1,
      },
      qualityControl: {
        formatCorrect: true,
        instructionsFollowed: toolInteraction.correctToolSelected,
      },
      toolInteraction,
      // Tokens and time are not tracked for a single step.
      systemMetrics: {totalTokens: 0, executionTime: 0, toolCallLatency: 0},
      overallScore,
      feedback,
    };
  }

  /**
   * Evaluates a whole agent run: whether it called an expected tool within
   * the test's step limit and ended with a response, and what it cost.
   */
  evaluateTrajectory(
    testCase: TestCase,
    run: Run<AgentState>,
  ): EvaluationResult {
    if (run.snapshots.length === 0) {
      return failedEvaluation('No execution snapshots found');
    }
    const finalState = run.getFinalState();
    if (finalState === undefined) {
      return failedEvaluation('No final state found');
    }

    const stepsTaken = run.snapshots.filter(
      ({stepId}) => stepId !== '__entry__' && stepId !== '__termination__',
    ).length;
    const {messages, totalTokens} = finalState;
    const toolCallsMade = messages.flatMap((message) => toolNames(message));
    const expectedToolUsed = testCase.expectedTools.some((name) =>
      toolCallsMade.includes(name),
    );
    const withinStepLimit =
      testCase.maxSteps === undefined || stepsTaken <= testCase.maxSteps;
    const taskCompleted = expectedToolUsed && withinStepLimit;
    const hasFinalResponse = messages.some(
      (message) =>
        message instanceof AssistantMessage &&
        message.content !== null &&
        message.content !== '',
    );
    const executionTime =
      run.endTimestamp === undefined
        ? 0
        : (run.endTimestamp.getTime() - run.startTimestamp.getTime()) / 1000;

    return {
      taskCompletion: {
        taskCompleted,
        stepsTaken,
        expectedSteps: testCase.maxSteps,
      },
      qualityControl: {
        formatCorrect: hasFinalResponse,
        instructionsFollowed: expectedToolUsed,
      },
      // The run finished, so assume the arguments were valid.
      toolInteraction: {
        correctToolSelected: expectedToolUsed,
        validArguments: true,
        toolResultUseful: expectedToolUsed,
      },
      systemMetrics: {
        totalTokens,
        executionTime,
        toolCallLatency: executionTime / Math.max(toolCallsMade.length, 1),
        costEstimate: estimateCost(totalTokens),
      },
      overallScore: scoreOf([
        taskCompleted,
        hasFinalResponse,
        expectedToolUsed,
        expectedToolUsed,
      ]),
      feedback:
        `Trajectory: ${stepsTaken} steps, ` +
        `Tools used: ${JSON.stringify(toolCallsMade)}, ` +
        `Expected: ${JSON.stringify(testCase.expectedTools)}`,
    };
  }
}

/** Returns the names of the tools an assistant message calls, if any. */
function toolNames(message: BaseMessage): string[] {
  if (!(message instanceof AssistantMessage)) {
    return [];
  }
  return (message.toolCalls ?? []).map((call) => call.function.name);
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Returns the share of checks that passed. */
function scoreOf(checks: readonly boolean[]): number {
  return checks.filter((check) => check).length / checks.length;
}

/**
 * Estimates a cost in US dollars from GPT-4o mini's prices, $0.15 per
 * million input tokens and $0.60 per million output tokens, assuming as many
 * of one as the other.
 */
function estimateCost(totalTokens: number): number {
  return totalTokens * ((0.15 + 0.6) / 2 / 1_000_000);
}

function failedEvaluation(reason: string): EvaluationResult {
  return {
    taskCompletion: {taskCompleted: false, stepsTaken: 0},
    qualityControl: {formatCorrect: false, instructionsFollowed: false},
    toolInteraction: {
      correctToolSelected: false,
      validArguments: false,
      toolResultUseful: false,
    },
    systemMetrics: {totalTokens: 0, executionTime: 0, toolCallLatency: 0},
    overallScore: 0,
    feedback: reason,
  };
}
