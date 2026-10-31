import {describe, expect, it} from 'vitest';
import {SessionNotFoundError, ShortTermMemory} from '../src/memory.js';

describe('ShortTermMemory', () => {
  it('keeps objects per session, with a default session', () => {
    const memory = new ShortTermMemory<string>();
    memory.add('a');
    expect(memory.createSession('chat')).toBe(true);
    expect(memory.createSession('chat')).toBe(false);
    memory.add('x', 'chat');
    memory.add('y', 'chat');
    expect(memory.getAllObjects()).toEqual(['a']);
    expect(memory.getLastObject('chat')).toBe('y');
    expect(memory.pop('chat')).toBe('y');
    expect(memory.getAllObjects('chat')).toEqual(['x']);
    expect(memory.getAllSessions()).toEqual(['default', 'chat']);
  });

  it('resets one session, or every session', () => {
    const memory = new ShortTermMemory<number>();
    memory.createSession('other');
    memory.add(1);
    memory.add(2, 'other');
    memory.reset('other');
    expect(memory.getAllObjects()).toEqual([1]);
    memory.reset();
    expect(memory.getAllObjects()).toEqual([]);
  });

  it('rejects unknown sessions and keeps the default one', () => {
    const memory = new ShortTermMemory<string>();
    expect(() => memory.add('x', 'missing')).toThrow(SessionNotFoundError);
    expect(() => memory.deleteSession('default')).toThrow(
      'Cannot delete the default session',
    );
    expect(memory.deleteSession('missing')).toBe(false);
  });
});
