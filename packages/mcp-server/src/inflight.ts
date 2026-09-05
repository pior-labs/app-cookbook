// Tracks work that must finish before the process may exit.
//
// A stdio server learns its client is gone by stdin closing, and that can land
// while a tool call is still running. Exiting right then drops the reply and
// tears the database pool out from under a query that is still on the wire. It
// is not hypothetical: a client that writes its requests and closes the pipe -
// a script, a batch session, the smoke check - reaches EOF long before the
// answers come back.
//
// Both halves count. A handler returning is not the same as its answer having
// been written, so `index.ts` wraps the transport's `send` with this too.

let active = 0;
let idleWaiters: (() => void)[] = [];

export function begin(): void {
  active += 1;
}

export function end(): void {
  active -= 1;
  if (active > 0) return;

  // Deferred, not immediate. When a tool handler returns, the SDK's own
  // continuation - the one that goes on to send the reply - is queued as a
  // microtask. Waking the waiters synchronously would let shutdown run first
  // and close the transport before that send was ever registered, which is the
  // very race this exists to close.
  const waiters = idleWaiters;
  idleWaiters = [];
  setImmediate(() => {
    for (const wake of waiters) wake();
  });
}

export async function track<T>(work: () => Promise<T>): Promise<T> {
  begin();
  try {
    return await work();
  } finally {
    end();
  }
}

// Resolves once nothing is in flight, or once `timeoutMs` has passed. The
// timeout is the point: a query that never returns must not turn "the client
// went away" into a process that outlives it, which is the leak this whole
// shutdown path exists to prevent.
export function whenIdle(timeoutMs: number): Promise<void> {
  if (active === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    // Unreferenced so a pending timer is not itself a reason to stay alive.
    timer.unref?.();

    idleWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
