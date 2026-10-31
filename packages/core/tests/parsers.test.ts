import {describe, expect, it} from 'vitest';
import * as z from 'zod';
import {AssistantMessage} from '../src/messages.js';
import {
  JsonOutputParser,
  StringOutputParser,
  ToolOutputParser,
  ZodOutputParser,
} from '../src/parsers.js';

const json = new AssistantMessage({content: '{"answer": 5}'});
const toolCallsOnly = new AssistantMessage({
  content: null,
  toolCalls: [
    {
      id: 'call_1',
      type: 'function',
      function: {name: 'add', arguments: '{"a": 2, "b": 3}'},
    },
  ],
});

describe('output parsers', () => {
  it('return the text, or null when the reply only calls tools', () => {
    const parser = new StringOutputParser();
    expect(parser.parse(json)).toBe('{"answer": 5}');
    expect(parser.parse(toolCallsOnly)).toBeNull();
  });

  it('decode the arguments of tool calls', () => {
    const parser = new ToolOutputParser();
    expect(parser.parse(toolCallsOnly)).toEqual([
      {toolCallId: 'call_1', args: {a: 2, b: 3}, functionName: 'add'},
    ]);
    expect(parser.parse(json)).toEqual([]);
  });

  it('decode JSON content, and need content to decode', () => {
    const parser = new JsonOutputParser();
    expect(parser.parse(json)).toEqual({answer: 5});
    expect(() => parser.parse(toolCallsOnly)).toThrow(/no content/);
  });

  it('validate JSON content with a Zod schema', () => {
    const answer = new ZodOutputParser(z.object({answer: z.number()}));
    expect(answer.parse(json).answer).toBe(5);
    const text = new ZodOutputParser(z.object({answer: z.string()}));
    expect(() => text.parse(json)).toThrow(z.ZodError);
  });
});
