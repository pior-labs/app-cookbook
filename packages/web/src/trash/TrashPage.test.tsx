import type { TrashedRecipe } from '@cookbook/domain';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeDetailPage } from '../recipes/RecipeDetailPage.jsx';
import { TrashPage } from './TrashPage.jsx';

// Recoverable deletion on the screens (technical design sections 10, 11.3, and
// 14.3). Restoring is one press; destroying a recipe is not, and the tests care
// most about the difference between them.

vi.mock('../auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.test' },
    loading: false,
    signOut: vi.fn(),
    startSignIn: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

const CHILI: TrashedRecipe = {
  id: 12,
  name: 'Weeknight Chili',
  description: 'A one-pot chili.',
  categoryName: 'Dinner',
  createdAt: '2026-08-01T00:00:00.000Z',
  deletedAt: '2026-08-20T18:30:00.000Z',
  deletedByUserId: 1,
  deletedByName: 'Ada Lovelace',
};

const ROAST: TrashedRecipe = {
  ...CHILI,
  id: 13,
  name: 'Sunday Roast',
  description: '',
  deletedAt: '2026-08-19T09:00:00.000Z',
  deletedByName: 'Grace Hopper',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message, fields: {} } }, status);
}

interface Request {
  method: string;
  path: string;
}

// Records every mutation the screen makes, so a test can assert what was sent
// as well as what was shown.
function mockApi(
  respond: (request: Request, call: number) => Response | undefined = () => undefined,
): Request[] {
  const requests: Request[] = [];
  let calls = 0;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const raw = typeof input === 'string' ? input : (input as globalThis.Request).url;
    const url = new URL(raw, 'http://localhost');
    const method = init?.method ?? 'GET';
    const request: Request = { method, path: url.pathname };

    if (method !== 'GET') requests.push(request);

    const custom = respond(request, calls++);
    if (custom) return custom;

    if (method === 'GET' && url.pathname === '/api/trash') {
      return jsonResponse({ items: [CHILI, ROAST], nextCursor: null });
    }

    return new Response(null, { status: 204 });
  });

  return requests;
}

function renderTrash() {
  return render(
    <MemoryRouter initialEntries={['/trash']}>
      <TrashPage />
    </MemoryRouter>,
  );
}

async function rowFor(name: string): Promise<HTMLElement> {
  return (await screen.findByRole('button', { name: `Restore ${name}` })).closest('li')!;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('trash', () => {
  it('lists what was deleted, when, and by whom', async () => {
    mockApi();
    renderTrash();

    const row = within(await rowFor('Weeknight Chili'));
    expect(row.getByText(/Deleted .* by Ada Lovelace/)).toBeInTheDocument();
    expect(row.getByText('Dinner')).toBeInTheDocument();

    expect(
      within(await rowFor('Sunday Roast')).getByText(/by Grace Hopper/),
    ).toBeInTheDocument();
  });

  it('explains what an empty Trash means', async () => {
    mockApi((request) =>
      request.method === 'GET' ? jsonResponse({ items: [], nextCursor: null }) : undefined,
    );
    renderTrash();

    expect(await screen.findByText('Trash is empty.')).toBeInTheDocument();
  });

  it('restores a recipe in one press and reloads what is left', async () => {
    let restored = false;
    const requests = mockApi((request) => {
      if (request.method === 'POST') {
        restored = true;
        return new Response(null, { status: 204 });
      }

      if (request.method === 'GET') {
        return jsonResponse({ items: restored ? [ROAST] : [CHILI, ROAST], nextCursor: null });
      }

      return undefined;
    });
    renderTrash();

    await userEvent.click(await screen.findByRole('button', { name: 'Restore Weeknight Chili' }));

    await waitFor(() =>
      expect(requests).toContainEqual({ method: 'POST', path: '/api/trash/12/restore' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Restore Weeknight Chili' })).toBeNull(),
    );
    expect(await screen.findByRole('button', { name: 'Restore Sunday Roast' })).toBeInTheDocument();
  });

  it('will not permanently delete until the recipe name is typed', async () => {
    const requests = mockApi();
    renderTrash();

    const row = within(await rowFor('Weeknight Chili'));
    await userEvent.click(row.getByRole('button', { name: 'Delete Weeknight Chili forever' }));

    const confirm = row.getByLabelText(/Type .*Weeknight Chili.* to delete it forever/);
    await userEvent.type(confirm, 'Weeknight');
    await userEvent.click(row.getAllByRole('button', { name: 'Delete forever' })[0]);

    expect(await row.findByRole('alert')).toBeInTheDocument();
    expect(requests).toHaveLength(0);

    await userEvent.type(confirm, ' Chili');
    await userEvent.click(row.getAllByRole('button', { name: 'Delete forever' })[0]);

    await waitFor(() =>
      expect(requests).toContainEqual({ method: 'DELETE', path: '/api/trash/12' }),
    );
  });

  it('accepts the typed name however it was capitalized', async () => {
    const requests = mockApi();
    renderTrash();

    const row = within(await rowFor('Weeknight Chili'));
    await userEvent.click(row.getByRole('button', { name: 'Delete Weeknight Chili forever' }));
    await userEvent.type(
      row.getByLabelText(/Type .*Weeknight Chili.* to delete it forever/),
      'weeknight chili',
    );
    await userEvent.click(row.getAllByRole('button', { name: 'Delete forever' })[0]);

    await waitFor(() =>
      expect(requests).toContainEqual({ method: 'DELETE', path: '/api/trash/12' }),
    );
  });

  it('keeps the row and explains a failed restore', async () => {
    mockApi((request) =>
      request.method === 'POST'
        ? errorResponse(404, 'recipe_not_in_trash', 'This recipe is not in Trash.')
        : undefined,
    );
    renderTrash();

    await userEvent.click(await screen.findByRole('button', { name: 'Restore Weeknight Chili' }));

    const row = within(await rowFor('Weeknight Chili'));
    expect(await row.findByRole('alert')).toHaveTextContent('This recipe is not in Trash.');
  });
});

describe('deleting from recipe detail', () => {
  const RECIPE = {
    id: 12,
    name: 'Weeknight Chili',
    description: 'A one-pot chili.',
    categoryId: 1,
    categoryName: 'Dinner',
    prepMinutes: 15,
    cookMinutes: 45,
    totalMinutes: 60,
    rating: { average: null, count: 0 },
    hasImage: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userState: { favorite: false, rating: null },
    baseServings: 4,
    notes: null,
    sourceUrl: null,
    sourceText: null,
    createdByUserId: 1,
    version: 1,
    ingredients: [],
    instructions: [{ id: 1, position: 0, body: 'Brown the beef.' }],
    tags: [],
    image: null,
  };

  function renderDetail() {
    return render(
      <MemoryRouter initialEntries={['/recipes/12']}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/trash" element={<p>Trash</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('asks before deleting, then moves the recipe to Trash', async () => {
    const requests: Request[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const raw = typeof input === 'string' ? input : (input as globalThis.Request).url;
      const url = new URL(raw, 'http://localhost');
      const method = init?.method ?? 'GET';

      if (method !== 'GET') requests.push({ method, path: url.pathname });
      if (method === 'GET') return jsonResponse(RECIPE);

      return new Response(null, { status: 204 });
    });

    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Move to Trash' }));
    expect(screen.getByText(/You can restore it from there/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Move to Trash' })[0]);

    await waitFor(() =>
      expect(requests).toContainEqual({ method: 'DELETE', path: '/api/recipes/12' }),
    );
    expect(await screen.findByText('Trash')).toBeInTheDocument();
  });

  it('keeps the recipe when the confirmation is dismissed', async () => {
    const requests: Request[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const method = init?.method ?? 'GET';
      const raw = typeof input === 'string' ? input : (input as globalThis.Request).url;

      if (method !== 'GET') {
        requests.push({ method, path: new URL(raw, 'http://localhost').pathname });
      }
      if (method === 'GET') return jsonResponse(RECIPE);

      return new Response(null, { status: 204 });
    });

    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Move to Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByText(/You can restore it from there/)).toBeNull();
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
  });
});
