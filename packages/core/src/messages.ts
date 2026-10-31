/**
 * @fileoverview Chat messages for OpenAI chat completions. A message keeps
 * what the conversation needs, and `toJSON()` gives the form a request sends.
 */

import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat/completions';
import type {ToolCall} from './tooling.js';

/** A chat message. */
export abstract class BaseMessage {
  abstract readonly role: 'system' | 'user' | 'assistant' | 'tool';
  abstract readonly content: string | null;

  /** Returns the message as a chat completion request sends it. */
  abstract toJSON(): ChatCompletionMessageParam;
}

/** Options for a message with text content. */
export interface MessageOptions {
  /** Defaults to an empty string. */
  content?: string;
}

/** Instructions that set how the assistant behaves. */
export class SystemMessage extends BaseMessage {
  readonly role = 'system';
  readonly content: string;

  constructor({content = ''}: MessageOptions = {}) {
    super();
    this.content = content;
  }

  toJSON(): ChatCompletionSystemMessageParam {
    return {role: this.role, content: this.content};
  }
}

/** A message from the user. */
export class UserMessage extends BaseMessage {
  readonly role = 'user';
  readonly content: string;

  constructor({content = ''}: MessageOptions = {}) {
    super();
    this.content = content;
  }

  toJSON(): ChatCompletionUserMessageParam {
    return {role: this.role, content: this.content};
  }
}

/** Options for a `ToolMessage`. */
export interface ToolMessageOptions extends MessageOptions {
  /** The ID of the tool call this message answers. */
  toolCallId: string;
  /** The name of the tool that ran. */
  name: string;
}

/** A tool's result, answering one of the assistant's tool calls. */
export class ToolMessage extends BaseMessage {
  readonly role = 'tool';
  readonly content: string;
  readonly toolCallId: string;
  /** Requests leave the name out, since the call ID identifies the call. */
  readonly name: string;

  constructor({content = '', toolCallId, name}: ToolMessageOptions) {
    super();
    this.content = content;
    this.toolCallId = toolCallId;
    this.name = name;
  }

  toJSON(): ChatCompletionToolMessageParam {
    return {
      role: this.role,
      content: this.content,
      tool_call_id: this.toolCallId,
    };
  }
}

/** The tokens a chat completion used. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Options for an `AssistantMessage`. */
export interface AssistantMessageOptions {
  /**
   * The assistant's text, or null when it only calls tools. Defaults to an
   * empty string.
   */
  content?: string | null;
  /** The function tools the assistant asked to call. */
  toolCalls?: ToolCall[];
  /** The tokens the completion used. */
  tokenUsage?: TokenUsage;
}

/** A message from the assistant, which may ask to call tools. */
export class AssistantMessage extends BaseMessage {
  readonly role = 'assistant';
  readonly content: string | null;
  readonly toolCalls: ToolCall[] | undefined;
  /** For accounting; requests leave it out. */
  readonly tokenUsage: TokenUsage | undefined;

  constructor({
    content = '',
    toolCalls,
    tokenUsage,
  }: AssistantMessageOptions = {}) {
    super();
    this.content = content;
    this.toolCalls = toolCalls;
    this.tokenUsage = tokenUsage;
  }

  toJSON(): ChatCompletionAssistantMessageParam {
    const message: ChatCompletionAssistantMessageParam = {
      role: this.role,
      content: this.content,
    };
    // The API rejects an empty `tool_calls` array.
    if (this.toolCalls !== undefined && this.toolCalls.length > 0) {
      message.tool_calls = this.toolCalls;
    }
    return message;
  }
}

/** Any message a conversation holds. */
export type AnyMessage =
  SystemMessage | UserMessage | AssistantMessage | ToolMessage;
