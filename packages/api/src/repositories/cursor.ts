// The opaque keyset cursor every paginated list issues (technical design
// section 7.2). It carries the ordering it was issued for, the last row's sort
// key, and the last row's ID, so a page continues from exactly where the
// previous one stopped even when rows are added, renamed, rated, or deleted in
// between. Offsets would silently skip or repeat rows when that happens.
//
// It is opaque rather than secret: a client that built one by hand would be
// depending on an ordering the server is free to change.

export interface CursorPayload<TSort extends string> {
  sort: TSort;
  key: string;
  id: number;
}

export class InvalidCursorError extends Error {}

export function encodeCursor<TSort extends string>(payload: CursorPayload<TSort>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<TSort extends string>(
  cursor: string,
  sort: TSort,
): CursorPayload<TSort> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError('Cursor is not decodable.');
  }

  const payload = parsed as Partial<CursorPayload<TSort>> | null;

  if (
    !payload ||
    typeof payload.key !== 'string' ||
    typeof payload.id !== 'number' ||
    !Number.isSafeInteger(payload.id) ||
    // A cursor issued for one ordering describes nothing about another, so
    // changing the sort must restart rather than resume from a stale key.
    payload.sort !== sort
  ) {
    throw new InvalidCursorError('Cursor does not belong to this query.');
  }

  return { sort, key: payload.key, id: payload.id };
}
