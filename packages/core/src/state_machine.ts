/**
 * @fileoverview A state machine that runs one step at a time over a shared
 * state and records a snapshot of the state after each step.
 *
 * Steps return new values instead of changing the state they receive, since
 * snapshots keep the state objects themselves, not copies.
 */

import {randomUUID} from 'node:crypto';
import type * as z from 'zod';

/** Values a step can use besides the state, such as an LLM. */
export interface Resource {
  vars: Record<string, unknown>;
}

/**
 * A step's work: it reads the state, and the run's resource if it has one,
 * and returns new values for some of the state's fields.
 */
export type StepLogic<State> = (
  state: State,
  resource: Resource | undefined,
) => Partial<State> | Promise<Partial<State>>;

/** A named unit of work in a state machine. */
export class Step<State extends object> {
  constructor(
    readonly stepId: string,
    readonly logic: StepLogic<State>,
  ) {}

  toString(): string {
    return `Step('${this.stepId}')`;
  }

  /**
   * Runs the logic and returns the state with the fields it returned. Fields
   * that the schema does not declare are dropped.
   */
  async run(
    state: State,
    stateSchema: z.ZodObject,
    resource?: Resource,
  ): Promise<State> {
    const result = await this.logic(state, resource);
    const fields = Object.keys(stateSchema.shape);
    const updates = Object.entries(result).filter(([field]) =>
      fields.includes(field),
    );
    return {...state, ...Object.fromEntries(updates)};
  }
}

/** Marks where a run starts; connect it to the first step. */
export class EntryPoint<State extends object> extends Step<State> {
  constructor() {
    super('__entry__', () => ({}));
  }
}

/** Marks where a run ends; connect the last steps to it. */
export class Termination<State extends object> extends Step<State> {
  constructor() {
    super('__termination__', () => ({}));
  }
}

/** Picks the next steps from the state: a step, a step ID, or a list. */
export type TransitionCondition<State extends object> = (
  state: State,
) => Step<State> | string | Array<Step<State> | string>;

/** The way out of a step: fixed targets, or a condition that picks them. */
export class Transition<State extends object> {
  constructor(
    readonly source: string,
    readonly targets: readonly string[],
    readonly condition?: TransitionCondition<State>,
  ) {}

  toString(): string {
    return `Transition('${this.source}' -> ${JSON.stringify(this.targets)})`;
  }

  /** Returns the IDs of the steps that follow the source for the state. */
  resolve(state: State): string[] {
    if (this.condition === undefined) {
      return [...this.targets];
    }
    const result = this.condition(state);
    return (Array.isArray(result) ? result : [result]).map((target) =>
      target instanceof Step ? target.stepId : target,
    );
  }
}

/** The state as one step left it. */
export class Snapshot<State extends object> {
  constructor(
    readonly snapshotId: string,
    readonly timestamp: Date,
    readonly stateData: State,
    readonly stateSchema: z.ZodObject,
    readonly stepId: string,
  ) {}

  /** Makes a snapshot with a new ID, taken now. */
  static create<State extends object>(
    stateData: State,
    stateSchema: z.ZodObject,
    stepId: string,
  ): Snapshot<State> {
    const id = randomUUID();
    return new Snapshot(id, new Date(), stateData, stateSchema, stepId);
  }

  toString(): string {
    const time = this.timestamp.toISOString();
    const state = JSON.stringify(this.stateData);
    return (
      `Snapshot('${this.snapshotId}') @ [${time}]: ` +
      `${this.stepId}.State(${state})`
    );
  }
}

/** A run's ID, start and end as ISO 8601 times, and snapshot count. */
export interface RunMetadata {
  runId: string;
  startTimestamp: string;
  endTimestamp: string | undefined;
  snapshotCount: number;
}

/** One execution of a state machine, with a snapshot after each step. */
export class Run<State extends object> {
  readonly snapshots: Array<Snapshot<State>> = [];
  /** Set when the run completes. */
  endTimestamp?: Date;

  constructor(
    readonly runId: string,
    readonly startTimestamp: Date,
  ) {}

  /** Makes a run with a new ID, started now. */
  static create<T extends object>(): Run<T> {
    return new Run<T>(randomUUID(), new Date());
  }

  get metadata(): RunMetadata {
    return {
      runId: this.runId,
      startTimestamp: this.startTimestamp.toISOString(),
      endTimestamp: this.endTimestamp?.toISOString(),
      snapshotCount: this.snapshots.length,
    };
  }

  toString(): string {
    return `Run('${this.runId}')`;
  }

  addSnapshot(snapshot: Snapshot<State>): void {
    this.snapshots.push(snapshot);
  }

  /** Marks the run as complete. */
  complete(): void {
    this.endTimestamp = new Date();
  }

  /** Returns the state after the last step, or undefined before any step. */
  getFinalState(): State | undefined {
    return this.snapshots.at(-1)?.stateData;
  }
}

/** Runs steps over a state whose fields a Zod object schema declares. */
export class StateMachine<State extends object> {
  readonly steps = new Map<string, Step<State>>();
  readonly transitions = new Map<string, Array<Transition<State>>>();

  constructor(readonly stateSchema: z.ZodObject & z.ZodType<State>) {}

  toString(): string {
    const fields = Object.keys(this.stateSchema.shape);
    return `StateMachine(schema=${JSON.stringify(fields)})`;
  }

  /** Adds steps, replacing any with the same ID. */
  addSteps(steps: ReadonlyArray<Step<State>>): void {
    for (const step of steps) {
      this.steps.set(step.stepId, step);
    }
  }

  /**
   * Connects a step to the steps that may follow it. Without a condition the
   * targets follow; with one, the condition picks from the state.
   */
  connect(
    source: Step<State> | string,
    targets: Step<State> | string | Array<Step<State> | string>,
    condition?: TransitionCondition<State>,
  ): void {
    const sourceId = source instanceof Step ? source.stepId : source;
    const targetIds = (Array.isArray(targets) ? targets : [targets]).map(
      (target) => (target instanceof Step ? target.stepId : target),
    );
    const transition = new Transition<State>(sourceId, targetIds, condition);
    const transitions = this.transitions.get(sourceId);
    if (transitions === undefined) {
      this.transitions.set(sourceId, [transition]);
    } else {
      transitions.push(transition);
    }
  }

  /**
   * Runs from the entry point to the termination step, snapshotting the state
   * after each step, and returns the run. Throws if the state has none of the
   * schema's fields, if there is not exactly one entry point, or if a step
   * leads to no step or to more than one.
   */
  async run(state: State, resource?: Resource): Promise<Run<State>> {
    const fields = Object.keys(this.stateSchema.shape);
    if (!Object.keys(state).some((key) => fields.includes(key))) {
      throw new Error(
        'Initial state must have at least one field from the schema. ' +
          `Expected fields: ${JSON.stringify(fields)}`,
      );
    }
    const entryPoints = [...this.steps.values()].filter(
      (step) => step instanceof EntryPoint,
    );
    if (entryPoints.length === 0) {
      throw new Error('No EntryPoint step found in workflow');
    }
    if (entryPoints.length > 1) {
      throw new Error('Multiple EntryPoint steps found in workflow');
    }

    const run = Run.create<State>();
    let current = state;
    let stepId = entryPoints[0].stepId;
    while (stepId !== '') {
      const step = this.steps.get(stepId);
      if (step === undefined) {
        throw new Error(`[StateMachine] Unknown step: ${stepId}`);
      }
      if (step instanceof Termination) {
        console.log(`[StateMachine] Terminating: ${stepId}`);
        break;
      }

      current = await step.run(current, this.stateSchema, resource);
      console.log(
        step instanceof EntryPoint
          ? `[StateMachine] Starting: ${stepId}`
          : `[StateMachine] Executing step: ${stepId}`,
      );
      run.addSnapshot(Snapshot.create(current, this.stateSchema, stepId));

      const nextSteps = (this.transitions.get(stepId) ?? []).flatMap(
        (transition) => transition.resolve(current),
      );
      if (nextSteps.length === 0) {
        throw new Error(
          `[StateMachine] No transitions found from step: ${stepId}`,
        );
      }
      if (nextSteps.length > 1) {
        throw new Error('Parallel execution not implemented yet.');
      }
      stepId = nextSteps[0];
    }
    run.complete();
    return run;
  }
}
