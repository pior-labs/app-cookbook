import { validationError } from '../errors.js';
import { InvalidCursorError } from '../repositories/index.js';

// Every paginated list answers a bad cursor the same way. A cursor is opaque,
// so a client cannot repair one: naming the parameter that is wrong lets the
// screen drop it and reload the first page instead of showing a dead end
// (technical design sections 7.2 and 11.3).
export async function withCursorErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      throw validationError('That page link is no longer valid.', {
        cursor: ['Start from the first page of results.'],
      });
    }

    throw error;
  }
}
