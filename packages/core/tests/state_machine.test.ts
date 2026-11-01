import {describe, expect, it, vi} from 'vitest';
import * as z from 'zod';
import {
  EntryPoint,
  StateMachine,
  Step,
  Termination,
} from '../src/state_machine.js';

const CounterState = z.object({count: z.number(), log: z.array(z.string())});
type CounterState = z.infer<typeof CounterState>;

function counter(): StateMachine<CounterState> {
  const increment = new Step<CounterState>('increment', (state, resource) => {
    const step = Number(resource?.vars.step ?? 1);
    return {count: state.count + step, log: [...state.log, `+${step}`]};
  });
  const machine = new StateMachine(CounterState);
  machine.addSteps([
    new EntryPoint<CounterState>(),
    increment,
    new Termination<CounterState>(),
  ]);
  machine.connect('__entry__', increment);
  machine.connect(increment, [increment, '__termination__'], (state) =>
    state.count < 3 ? increment : '__termination__',
  );
  return machine;
}

describe('StateMachine', () => {
  it('runs without writing to the console', async () => {
    const log = vi.spyOn(console, 'log');
    await counter().run({count: 0, log: []}, {vars: {step: 1}});
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('runs to termination and snapshots each step', async () => {
    const run = await counter().run({count: 0, log: []}, {vars: {step: 1}});
    expect(run.snapshots.map((snapshot) => snapshot.stepId)).toEqual([
      '__entry__',
      'increment',
      'increment',
      'increment',
    ]);
    expect(run.getFinalState()).toEqual({count: 3, log: ['+1', '+1', '+1']});
    expect(run.metadata.endTimestamp).toBeDefined();
  });

  it('drops fields that the schema does not declare', async () => {
    const extra = new Step<CounterState>('extra', () => {
      const update = {count: 1, note: 'dropped'};
      return update;
    });
    const machine = new StateMachine(CounterState);
    machine.addSteps([
      new EntryPoint<CounterState>(),
      extra,
      new Termination<CounterState>(),
    ]);
    machine.connect('__entry__', extra);
    machine.connect(extra, '__termination__');
    const run = await machine.run({count: 0, log: []});
    expect(run.getFinalState()).toEqual({count: 1, log: []});
  });

  it('rejects workflows it cannot run', async () => {
    const empty = new StateMachine(CounterState);
    await expect(empty.run({count: 0, log: []})).rejects.toThrow(
      'No EntryPoint step found',
    );

    const parallel = new StateMachine(CounterState);
    parallel.addSteps([
      new EntryPoint<CounterState>(),
      new Step<CounterState>('a', () => ({})),
      new Step<CounterState>('b', () => ({})),
    ]);
    parallel.connect('__entry__', ['a', 'b']);
    await expect(parallel.run({count: 0, log: []})).rejects.toThrow(
      'Parallel execution not implemented yet.',
    );
  });
});
