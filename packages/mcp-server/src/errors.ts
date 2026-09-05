// A driver error's `message` describes the statement that failed; the reason it
// failed - refused connection, unknown host, bad password - is on `cause`.
// Reporting only the message sends an operator looking at the wrong thing: an
// unreachable database reads as though this query were malformed.
//
// Shared by the server's startup path and the container health probe, which are
// the two places a connection problem first shows up.
export function describeCause(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (cause instanceof Error && cause.message !== error.message) {
    return `${cause.message} (while running: ${error.message.split('\n')[0]})`;
  }

  return error.message.split('\n')[0];
}
