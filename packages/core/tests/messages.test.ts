import {describe, expect, it} from 'vitest';
import {
  AssistantMessage,
  BaseMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from '../src/messages.js';
import type {ToolCall} from '../src/tooling.js';

const call: ToolCall = {
  id: 'call_1',
  type: 'function',
  function: {name: 'add', arguments: '{"a": 1, "b": 2}'},
};

describe('messages', () => {
  it('turn into chat completion request messages', () => {
    expect(new SystemMessage({content: 'Be brief.'}).toJSON()).toEqual({
      role: 'system',
      content: 'Be brief.',
    });
    expect(new UserMessage().toJSON()).toEqual({role: 'user', content: ''});
    expect(
      new AssistantMessage({content: null, toolCalls: [call]}).toJSON(),
    ).toEqual({role: 'assistant', content: null, tool_calls: [call]});
  });

  it('keep the tool name and token usage out of requests', () => {
    const result = new ToolMessage({
      content: '3',
      toolCallId: 'call_1',
      name: 'add',
    });
    expect(result.name).toBe('add');
    expect(result.toJSON()).toEqual({
      role: 'tool',
      content: '3',
      tool_call_id: 'call_1',
    });
    const reply = new AssistantMessage({
      content: 'Hi',
      tokenUsage: {promptTokens: 1, completionTokens: 1, totalTokens: 2},
    });
    expect(reply.toJSON()).toEqual({role: 'assistant', content: 'Hi'});
  });

  it('leave out an empty list of tool calls', () => {
    const reply = new AssistantMessage({content: 'Done.', toolCalls: []});
    expect(reply.toJSON()).toEqual({role: 'assistant', content: 'Done.'});
  });

  it('are all base messages', () => {
    expect(new ToolMessage({toolCallId: 'c', name: 'n'})).toBeInstanceOf(
      BaseMessage,
    );
  });
});
