/**
 * @fileoverview Output parsers that turn an assistant message into a value:
 * its text, its tool calls, its JSON content, or JSON that a Zod schema
 * validates.
 */

import type * as z from 'zod';
import type {AssistantMessage} from './messages.js';

/** Turns an assistant message into a value. */
export interface OutputParser<T = unknown> {
  parse(message: AssistantMessage): T;
}

/** Returns the message's text, or null when it only calls tools. */
export class StringOutputParser implements OutputParser<string | null> {
  parse(message: AssistantMessage): string | null {
    return message.content;
  }
}

/** A tool call with its arguments decoded from JSON. */
export interface ParsedToolCall {
  toolCallId: string;
  /** The decoded arguments, not yet validated. */
  args: unknown;
  functionName: string;
}

/**
 * Returns the message's tool calls with their arguments decoded, or an empty
 * list when it has none. Throws a `SyntaxError` if some arguments are not
 * valid JSON.
 */
export class ToolOutputParser implements OutputParser<ParsedToolCall[]> {
  parse(message: AssistantMessage): ParsedToolCall[] {
    return (message.toolCalls ?? []).map((call) => {
      const args: unknown = JSON.parse(call.function.arguments);
      return {toolCallId: call.id, args, functionName: call.function.name};
    });
  }
}

/**
 * Decodes the message's content as JSON. Throws if the message has no content
 * or the content is not valid JSON.
 */
export class JsonOutputParser implements OutputParser<unknown> {
  parse(message: AssistantMessage): unknown {
    return JSON.parse(contentOf(message));
  }
}

/**
 * Decodes the message's content as JSON and validates it with a Zod schema.
 * Throws if the message has no content or the content is not valid JSON, and
 * throws a `ZodError` if the value does not match the schema.
 */
export class ZodOutputParser<Schema extends z.ZodType> implements OutputParser<
  z.output<Schema>
> {
  constructor(readonly schema: Schema) {}

  parse(message: AssistantMessage): z.output<Schema> {
    return this.schema.parse(JSON.parse(contentOf(message)));
  }
}

/** Returns the message's content, throwing if it has none. */
function contentOf(message: AssistantMessage): string {
  if (message.content === null) {
    throw new Error('The assistant message has no content to parse.');
  }
  return message.content;
}
