/**
 * @fileoverview A chat model on OpenAI's chat completions API. It keeps the
 * tools the model may call and answers with an `AssistantMessage`.
 */

import {OpenAI} from 'openai';
import type {ChatCompletionCreateParamsNonStreaming} from 'openai/resources/chat/completions';
import {AssistantMessage, BaseMessage, UserMessage} from './messages.js';
import type {Tool} from './tooling.js';

/** Options for an `LLM`. */
export interface LLMOptions {
  /** The model to ask. Defaults to `gpt-4o-mini`. */
  model?: string;
  /** The sampling temperature. Defaults to 0. */
  temperature?: number;
  /** Tools the model may call; `registerTool` adds more later. */
  tools?: readonly Tool[];
  /** Defaults to the `OPENAI_API_KEY` environment variable. */
  apiKey?: string;
}

/**
 * A chat model that sends a conversation, with any registered tools, to
 * OpenAI's chat completions API and answers with an `AssistantMessage`.
 */
export class LLM {
  readonly model: string;
  readonly temperature: number;
  readonly client: OpenAI;
  /** The registered tools by name. */
  readonly tools = new Map<string, Tool>();

  constructor({
    model = 'gpt-4o-mini',
    temperature = 0,
    tools = [],
    apiKey,
  }: LLMOptions = {}) {
    this.model = model;
    this.temperature = temperature;
    this.client = new OpenAI({apiKey});
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /** Adds a tool the model may call, replacing any tool of the same name. */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Sends the conversation and returns the assistant's reply. A string becomes
   * a user message.
   *
   * With a response format, such as `zodResponseFormat(schema, name)` from
   * `openai/helpers/zod`, the request goes through the SDK's `parse`, which
   * throws if the reply does not match the format. `parse` also rejects tools
   * that are not strict, which no `Tool` is, so a response format needs an
   * `LLM` without tools.
   */
  async invoke(
    input: string | BaseMessage | readonly BaseMessage[],
    responseFormat?: ChatCompletionCreateParamsNonStreaming['response_format'],
  ): Promise<AssistantMessage> {
    const body = this.buildBody(toMessages(input));
    const completion =
      responseFormat === undefined
        ? await this.client.chat.completions.create(body)
        : await this.client.chat.completions.parse({
            ...body,
            response_format: responseFormat,
          });
    const choice = completion.choices[0];
    if (choice === undefined) {
      throw new Error('The chat completion has no choices.');
    }
    const {usage} = completion;
    return new AssistantMessage({
      content: choice.message.content,
      // Only function tools are sent, so only function tool calls come back.
      toolCalls: choice.message.tool_calls?.filter(
        (call) => call.type === 'function',
      ),
      tokenUsage:
        usage === undefined
          ? undefined
          : {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            },
    });
  }

  private buildBody(
    messages: readonly BaseMessage[],
  ): ChatCompletionCreateParamsNonStreaming {
    const body: ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      temperature: this.temperature,
      messages: messages.map((message) => message.toJSON()),
    };
    if (this.tools.size > 0) {
      body.tools = [...this.tools.values()].map((tool) => tool.toJSON());
      body.tool_choice = 'auto';
    }
    return body;
  }
}

/** Turns `invoke`'s input into a list of messages. */
function toMessages(
  input: string | BaseMessage | readonly BaseMessage[],
): readonly BaseMessage[] {
  if (typeof input === 'string') {
    return [new UserMessage({content: input})];
  }
  if (input instanceof BaseMessage) {
    return [input];
  }
  // Callers without types can pass anything, so check what TypeScript cannot.
  if (Array.isArray(input) && input.every((m) => m instanceof BaseMessage)) {
    return input;
  }
  throw new TypeError(
    'Input must be a string, a message, or a list of messages.',
  );
}
