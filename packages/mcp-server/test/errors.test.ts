import { describe, expect, it } from 'vitest';
import { describeCause } from '../src/errors.js';

// The connection failure this covers is the one an operator actually hits: the
// database is unreachable, and postgres reports it as a failed `select`, which
// reads like a bug in the query rather than a network problem.
describe('describeCause', () => {
  it('leads with the underlying cause rather than the statement that failed', () => {
    const error = new Error('Failed query: select "id" from "users" where ...\nparams: a@b.test', {
      cause: new Error('write CONNECT_TIMEOUT 10.255.255.1:5432'),
    });

    expect(describeCause(error)).toBe(
      'write CONNECT_TIMEOUT 10.255.255.1:5432 (while running: Failed query: select "id" from "users" where ...)',
    );
  });

  it('keeps only the first line, since a driver appends the parameters', () => {
    expect(describeCause(new Error('Failed query: select 1\nparams: 2'))).toBe('Failed query: select 1');
  });

  it('does not repeat itself when the cause says the same thing', () => {
    const message = 'Connection terminated unexpectedly';
    expect(describeCause(new Error(message, { cause: new Error(message) }))).toBe(message);
  });

  it('describes a thrown non-error rather than dropping it', () => {
    expect(describeCause('database is gone')).toBe('database is gone');
  });
});
