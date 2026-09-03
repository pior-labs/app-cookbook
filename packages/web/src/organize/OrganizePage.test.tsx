import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizePage } from './OrganizePage.jsx';

// Category and tag management, including the conflicts that block a delete
// (technical design sections 7.3 and 11.3).

vi.mock('../auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.test' },
    loading: false,
    signOut: vi.fn(),
    startSignIn: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

const CATEGORIES: CategorySummary[] = [
  {
    id: 1,
    name: 'Dinner',
    activeRecipeCount: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Snack',
    activeRecipeCount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const TAGS: TagSummary[] = [
  {
    id: 7,
    name: 'Weeknight',
    color: '#6b8db5',
    activeRecipeCount: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string, fields = {}): Response {
  return jsonResponse({ error: { code, message, fields } }, status);
}

interface Request {
  method: string;
  path: string;
  body: unknown;
}

// Records every mutation the screen makes, so a test can assert what was sent
// as well as what was shown.
function mockApi(
  respond: (request: Request) => Response | undefined = () => undefined,
): Request[] {
  const requests: Request[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const raw = typeof input === 'string' ? input : (input as globalThis.Request).url;
    const url = new URL(raw, 'http://localhost');
    const method = init?.method ?? 'GET';
    const request: Request = {
      method,
      path: url.pathname,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };

    if (method !== 'GET') requests.push(request);

    const custom = respond(request);
    if (custom) return custom;

    if (method === 'GET' && url.pathname === '/api/categories') return jsonResponse(CATEGORIES);
    if (method === 'GET' && url.pathname === '/api/tags') return jsonResponse(TAGS);

    return new Response(null, { status: 204 });
  });

  return requests;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/organize']}>
      <OrganizePage />
    </MemoryRouter>,
  );
}

// A row is found by the button that names it, so the lookup does not depend on
// where in the row the name happens to be rendered.
async function rowFor(name: string): Promise<HTMLElement> {
  return (await screen.findByRole('button', { name: `Rename ${name}` })).closest('li')!;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('organize', () => {
  it('lists categories and tags with how much uses each one', async () => {
    mockApi();
    renderPage();

    expect(within(await rowFor('Dinner')).getByText('2 recipes')).toBeInTheDocument();
    expect(within(await rowFor('Snack')).getByText('0 recipes')).toBeInTheDocument();
    expect(within(await rowFor('Weeknight')).getByText('3 recipes')).toBeInTheDocument();
  });

  it('renames a category', async () => {
    const requests = mockApi();
    renderPage();

    const row = within(await rowFor('Snack'));
    await userEvent.click(row.getByRole('button', { name: 'Rename Snack' }));
    await userEvent.clear(row.getByLabelText('Rename Snack'));
    await userEvent.type(row.getByLabelText('Rename Snack'), 'Snacks');
    await userEvent.click(row.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'PUT',
        path: '/api/categories/2',
        body: { name: 'Snacks' },
      }),
    );
  });

  it('explains what blocks a category delete and leaves the category in place', async () => {
    mockApi((request) =>
      request.method === 'DELETE'
        ? errorResponse(
            409,
            'category_in_use',
            '"Dinner" still holds 2 recipes. Move them to another category first.',
          )
        : undefined,
    );
    renderPage();

    const row = within(await rowFor('Dinner'));
    await userEvent.click(row.getByRole('button', { name: 'Delete Dinner' }));
    await userEvent.click(row.getByRole('button', { name: 'Yes, delete Dinner' }));

    expect(await row.findByRole('alert')).toHaveTextContent('still holds 2 recipes');
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('asks before deleting, and does nothing until the delete is confirmed', async () => {
    const requests = mockApi();
    renderPage();

    const row = within(await rowFor('Snack'));
    await userEvent.click(row.getByRole('button', { name: 'Delete Snack' }));

    expect(row.getByText(/no recipe, live or in Trash, is filed under it/)).toBeInTheDocument();

    await userEvent.click(row.getByRole('button', { name: 'Keep it' }));

    expect(requests).toEqual([]);
  });

  it('warns how many recipes a tag delete will touch, then deletes it', async () => {
    const requests = mockApi();
    renderPage();

    const row = within(await rowFor('Weeknight'));
    await userEvent.click(row.getByRole('button', { name: 'Delete Weeknight' }));

    expect(row.getByText(/removed from 3 recipes/)).toBeInTheDocument();

    await userEvent.click(row.getByRole('button', { name: 'Yes, delete Weeknight' }));

    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'DELETE',
        path: '/api/tags/7',
        body: undefined,
      }),
    );
  });

  it('keeps a rejected new name in the box with the reason', async () => {
    mockApi((request) =>
      request.method === 'POST'
        ? errorResponse(409, 'category_already_exists', 'The category "Dinner" already exists.', {
            name: ['This category already exists.'],
          })
        : undefined,
    );
    renderPage();

    await userEvent.type(await screen.findByLabelText('New category'), 'dinner');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('The category "Dinner" already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('New category')).toHaveValue('dinner');
  });

  it('refuses an empty name without asking the API', async () => {
    const requests = mockApi();
    renderPage();

    await userEvent.type(await screen.findByLabelText('New tag'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('clears the box and reloads the list after a successful create', async () => {
    const requests = mockApi((request) =>
      request.method === 'POST' ? jsonResponse({ id: 9, name: 'Sides' }, 201) : undefined,
    );
    renderPage();

    await userEvent.type(await screen.findByLabelText('New category'), 'Sides');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => expect(screen.getByLabelText('New category')).toHaveValue(''));
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/api/categories',
      body: { name: 'Sides' },
    });
  });

  it('sets a tag colour and sends the name with it', async () => {
    const requests = mockApi();
    renderPage();

    const row = within(await rowFor('Weeknight'));
    await userEvent.click(row.getByRole('button', { name: 'Colour Weeknight' }));
    await userEvent.click(row.getByRole('button', { name: 'Basil' }));

    // The name rides along because the endpoint writes the whole tag; sending
    // the colour alone would rename it to nothing.
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'PUT',
        path: '/api/tags/7',
        body: { name: 'Weeknight', color: '#5b8a5a' },
      }),
    );
  });

  it('takes a colour back off a tag', async () => {
    const requests = mockApi();
    renderPage();

    const row = within(await rowFor('Weeknight'));
    await userEvent.click(row.getByRole('button', { name: 'Colour Weeknight' }));
    await userEvent.click(row.getByRole('button', { name: 'No colour' }));

    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'PUT',
        path: '/api/tags/7',
        body: { name: 'Weeknight', color: null },
      }),
    );
  });

  it('creates a tag in the colour chosen alongside its name', async () => {
    const requests = mockApi((request) =>
      request.method === 'POST'
        ? jsonResponse({ id: 9, name: 'Comfort', color: '#c96442' }, 201)
        : undefined,
    );
    renderPage();

    await userEvent.type(await screen.findByLabelText('New tag'), 'Comfort');
    await userEvent.click(screen.getByRole('button', { name: 'Paprika' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));

    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'POST',
        path: '/api/tags',
        body: { name: 'Comfort', color: '#c96442' },
      }),
    );
  });

  it('offers retry when the lists cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('network down');
    });

    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
