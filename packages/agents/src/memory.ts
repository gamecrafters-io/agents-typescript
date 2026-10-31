/**
 * @fileoverview Short-term memory: lists of objects, such as agent runs, kept
 * per session. It stores the objects themselves, not copies.
 */

const DEFAULT_SESSION = 'default';

/** Thrown when a session does not exist. */
export class SessionNotFoundError extends Error {
  override name = 'SessionNotFoundError';

  constructor(sessionId: string) {
    super(`Session '${sessionId}' not found`);
  }
}

/**
 * The history of objects in each session. A `default` session always exists,
 * and methods without a session ID use it.
 */
export class ShortTermMemory<T = unknown> {
  readonly sessions = new Map<string, T[]>([[DEFAULT_SESSION, []]]);

  toString(): string {
    return `Memory(sessions=${JSON.stringify(this.getAllSessions())})`;
  }

  /** Creates a session; returns false if it already exists. */
  createSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      return false;
    }
    this.sessions.set(sessionId, []);
    return true;
  }

  /**
   * Deletes a session; returns false if it does not exist. Throws if asked to
   * delete the default session.
   */
  deleteSession(sessionId: string): boolean {
    if (sessionId === DEFAULT_SESSION) {
      throw new Error('Cannot delete the default session');
    }
    return this.sessions.delete(sessionId);
  }

  /** Adds an object to a session's history. */
  add(object: T, sessionId = DEFAULT_SESSION): void {
    this.objectsIn(sessionId).push(object);
  }

  /** Returns a session's objects, oldest first. */
  getAllObjects(sessionId = DEFAULT_SESSION): T[] {
    return [...this.objectsIn(sessionId)];
  }

  /** Returns a session's newest object, or undefined if it has none. */
  getLastObject(sessionId = DEFAULT_SESSION): T | undefined {
    return this.objectsIn(sessionId).at(-1);
  }

  getAllSessions(): string[] {
    return [...this.sessions.keys()];
  }

  /** Empties one session, or every session when none is given. */
  reset(sessionId?: string): void {
    if (sessionId === undefined) {
      for (const id of this.sessions.keys()) {
        this.sessions.set(id, []);
      }
      return;
    }
    this.objectsIn(sessionId);
    this.sessions.set(sessionId, []);
  }

  /** Removes and returns a session's newest object, if it has one. */
  pop(sessionId = DEFAULT_SESSION): T | undefined {
    return this.objectsIn(sessionId).pop();
  }

  /** Returns a session's list, throwing `SessionNotFoundError` if none. */
  private objectsIn(sessionId: string): T[] {
    const objects = this.sessions.get(sessionId);
    if (objects === undefined) {
      throw new SessionNotFoundError(sessionId);
    }
    return objects;
  }
}
