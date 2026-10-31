/**
 * @fileoverview Function tools for OpenAI chat completions. A Zod object
 * schema declares each tool's named arguments: its JSON Schema tells the model
 * what to send, and the same schema validates what the model sends back.
 */

import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions';
import type {FunctionParameters} from 'openai/resources/shared';
import * as z from 'zod';

/**
 * A function tool call in a chat completion. The SDK's
 * `ChatCompletionMessageToolCall` union also covers custom tool calls, which no
 * `Tool` can answer.
 */
export type ToolCall = ChatCompletionMessageFunctionToolCall;

/** Options for a `Tool`. */
export interface ToolOptions<Schema extends z.ZodObject> {
  /** The model-visible name. Defaults to the function's name. */
  name?: string;
  /** Tells the model what the tool does and when to call it. */
  description?: string;
  /**
   * Declares the named arguments. The model may omit fields that are optional
   * or have a default.
   */
  parameters: Schema;
}

/** A function that a chat completion can call with one object of arguments. */
export class Tool<Schema extends z.ZodObject = z.ZodObject, Result = unknown> {
  readonly name: string;
  readonly description: string | undefined;
  readonly parameters: Schema;
  private readonly jsonSchema: FunctionParameters;

  /**
   * Throws if the name is empty, as it is for an anonymous function without
   * `options.name`, or if the schema uses a type that JSON Schema cannot
   * represent, such as `z.date()`.
   *
   * @param func Receives the validated arguments, with defaults filled in.
   */
  constructor(
    readonly func: (args: z.output<Schema>) => Result,
    options: ToolOptions<Schema>,
  ) {
    this.name = options.name ?? func.name;
    if (this.name === '') {
      throw new Error(
        'A tool needs a name: pass options.name for an anonymous function.',
      );
    }
    this.description = options.description;
    this.parameters = options.parameters;
    // Describe the input side, which the model writes, so fields with defaults
    // stay optional. Drop `$schema` and forbid undeclared arguments.
    const {$schema, ...schema} = z.toJSONSchema(this.parameters, {io: 'input'});
    this.jsonSchema = {...schema, additionalProperties: false};
  }

  /**
   * Validates the arguments, fills in defaults, and calls the function. Throws
   * a `ZodError` if the arguments do not match the schema.
   */
  call(args: z.input<Schema>): Result {
    return this.func(this.parameters.parse(args));
  }

  /** Returns the definition for a chat completion request's `tools`. */
  toJSON(): ChatCompletionFunctionTool {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.jsonSchema,
      },
    };
  }

  /** Describes the tool for debugging: `<Tool name=add params=[a, b]>`. */
  toString(): string {
    const params = Object.keys(this.parameters.shape).join(', ');
    return `<Tool name=${this.name} params=[${params}]>`;
  }

  /** Makes a tool named after the function, with no description. */
  static fromFunc<Schema extends z.ZodObject, Result>(
    func: (args: z.output<Schema>) => Result,
    parameters: Schema,
  ): Tool<Schema, Result> {
    return new Tool(func, {parameters});
  }
}

/** Makes a tool from a function; shorthand for `new Tool(func, options)`. */
export function tool<Schema extends z.ZodObject, Result>(
  func: (args: z.output<Schema>) => Result,
  options: ToolOptions<Schema>,
): Tool<Schema, Result> {
  return new Tool(func, options);
}
