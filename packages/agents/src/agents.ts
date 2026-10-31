/**
 * @fileoverview An agent that answers a query by asking an LLM and running the
 * tools it calls until it replies without any. Each session keeps its
 * conversation across invocations.
 */

import {
  EntryPoint,
  LLM,
  StateMachine,
  Step,
  SystemMessage,
  Termination,
  ToolMessage,
  UserMessage,
  type AnyMessage,
  type Run,
  type Tool,
  type ToolCall,
} from '@gamecrafters/agents-core';
import * as z from 'zod';
import {ShortTermMemory} from './memory.js';

const AGENT_STATE_SCHEMA = z.object({
  /** The query this run answers. */
  userQuery: z.string(),
  /** The system instructions that open a new conversation. */
  instructions: z.string(),
  /** The conversation so far. */
  messages: z.array(z.custom<AnyMessage>()),
  /** Tool calls waiting to run, or null when there are none. */
  currentToolCalls: z.array(z.custom<ToolCall>()).nullable(),
  /** The tokens this run's completions used. */
  totalTokens: z.number(),
  /** The session whose conversation this run continues. */
  sessionId: z.string(),
});

/** The state an agent's run carries from step to step. */
export type AgentState = z.infer<typeof AGENT_STATE_SCHEMA>;

/** Options for an `Agent`. */
export interface AgentOptions {
  /** The model the agent asks. */
  modelName: string;
  /** The system instructions that open each new conversation. */
  instructions: string;
  /** Tools the model may call. */
  tools?: readonly Tool[];
  /** The sampling temperature. Defaults to 0.7. */
  temperature?: number;
}

/**
 * An agent that answers queries with an LLM and tools. Each `invoke` runs a
 * state machine (prepare messages, ask the LLM, run any tool calls and ask
 * again) and stores the run in its session, so the session's next query
 * continues the conversation.
 */
export class Agent {
  readonly modelName: string;
  readonly instructions: string;
  readonly tools: readonly Tool[];
  readonly temperature: number;
  readonly memory = new ShortTermMemory<Run<AgentState>>();
  readonly workflow: StateMachine<AgentState>;

  constructor({
    modelName,
    instructions,
    tools = [],
    temperature = 0.7,
  }: AgentOptions) {
    this.modelName = modelName;
    this.instructions = instructions;
    this.tools = tools;
    this.temperature = temperature;
    this.workflow = this.createStateMachine();
  }

  /**
   * Answers the query in a session, continuing its conversation, and returns
   * the run. The session defaults to `default`.
   */
  async invoke(query: string, sessionId = 'default'): Promise<Run<AgentState>> {
    this.memory.createSession(sessionId);
    const lastState = this.memory.getLastObject(sessionId)?.getFinalState();
    const run = await this.workflow.run({
      userQuery: query,
      instructions: this.instructions,
      messages: lastState?.messages ?? [],
      currentToolCalls: null,
      totalTokens: 0,
      sessionId,
    });
    this.memory.add(run, sessionId);
    return run;
  }

  /** Returns a session's runs, oldest first. */
  getSessionRuns(sessionId?: string): Array<Run<AgentState>> {
    return this.memory.getAllObjects(sessionId);
  }

  /** Forgets one session's runs, or every session's when none is given. */
  resetSession(sessionId?: string): void {
    this.memory.reset(sessionId);
  }

  private prepareMessagesStep(state: AgentState): Partial<AgentState> {
    const history =
      state.messages.length > 0
        ? state.messages
        : [new SystemMessage({content: state.instructions})];
    const query = new UserMessage({content: state.userQuery});
    return {messages: [...history, query]};
  }

  private async llmStep(state: AgentState): Promise<Partial<AgentState>> {
    // Made per step, so the API key is needed only once the agent runs.
    const llm = new LLM({
      model: this.modelName,
      temperature: this.temperature,
      tools: this.tools,
    });
    const reply = await llm.invoke(state.messages);
    const toolCalls = reply.toolCalls ?? [];
    return {
      messages: [...state.messages, reply],
      currentToolCalls: toolCalls.length > 0 ? toolCalls : null,
      totalTokens: state.totalTokens + (reply.tokenUsage?.totalTokens ?? 0),
    };
  }

  private async toolStep(state: AgentState): Promise<Partial<AgentState>> {
    const results: ToolMessage[] = [];
    for (const call of state.currentToolCalls ?? []) {
      const {name, arguments: args} = call.function;
      const tool = this.tools.find((candidate) => candidate.name === name);
      // A call to an unknown tool gets no tool message.
      if (tool === undefined) {
        continue;
      }
      // The model's arguments are untyped JSON; call() validates them
      // against the tool's schema.
      const decoded = JSON.parse(args) as Record<string, unknown>;
      const result = String(await tool.call(decoded));
      results.push(
        new ToolMessage({
          content: JSON.stringify(result),
          toolCallId: call.id,
          name,
        }),
      );
    }
    return {messages: [...state.messages, ...results], currentToolCalls: null};
  }

  private createStateMachine(): StateMachine<AgentState> {
    const machine = new StateMachine<AgentState>(AGENT_STATE_SCHEMA);
    const entry = new EntryPoint<AgentState>();
    const messagePrep = new Step<AgentState>('message_prep', (state) =>
      this.prepareMessagesStep(state),
    );
    const llmProcessor = new Step<AgentState>('llm_processor', (state) =>
      this.llmStep(state),
    );
    const toolExecutor = new Step<AgentState>('tool_executor', (state) =>
      this.toolStep(state),
    );
    const termination = new Termination<AgentState>();
    machine.addSteps([
      entry,
      messagePrep,
      llmProcessor,
      toolExecutor,
      termination,
    ]);

    machine.connect(entry, messagePrep);
    machine.connect(messagePrep, llmProcessor);
    // Run the tools the LLM called, or stop once it calls none.
    machine.connect(llmProcessor, [toolExecutor, termination], (state) =>
      state.currentToolCalls !== null && state.currentToolCalls.length > 0
        ? toolExecutor
        : termination,
    );
    machine.connect(toolExecutor, llmProcessor);
    return machine;
  }
}
