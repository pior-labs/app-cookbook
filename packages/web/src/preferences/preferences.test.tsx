import type { RecipeDetail, RecipeSummary } from '@cookbook/domain';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeDetailPage } from '../recipes/RecipeDetailPage.jsx';
import { FavoritesPage } from './FavoritesPage.jsx';
import { RecentPage } from './RecentPage.jsx';

// Favorites, ratings, and recent history on the screens
// (technical design sections 11.2, 11.3, and 14.3). Favorite and rating are
// the only optimistic interactions in the app, so the revert path matters as
// much as the happy one.

vi.mock('../auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.test' },
    loading: false,
    signOut: vi.fn(),
    startSignIn: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

const RECIPE: RecipeDetail = {
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
  ingredients: [
    {
      id: 1,
      position: 0,
      quantity: { numerator: 1, denominator: 1 },
      unitCode: 'lb',
      unitText: null,
      name: 'Ground beef',
      preparation: null,
    },
  ],
  instructions: [{ id: 1, position: 0, body: 'Brown the beef.' }],
  tags: [],
  image: null,
};

function summary(id: number, name: string, favorite = true): RecipeSummary {
  return {
    id,
    name,
    description: '',
    categoryId: 1,
    categoryName: 'Dinner',
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    rating: { average: null, count: 0 },
    hasImage: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    userState: { favorite, rating: null },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Call {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (call: Call) => Response | Promise<Response> | undefined;

function mockApi(respond: Handler = () => undefined): Call[] {
  const calls: Call[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const raw = typeof input === 'string' ? input : (input as Request).url;
    const url = new URL(raw, 'http://localhost');
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(call);

    const custom = await respond(call);
    if (custom) return custom;

    if (call.method === 'GET' && url.pathname === `/api/recipes/${RECIPE.id}`) {
      return jsonResponse(RECIPE);
    }

    return new Response(null, { status: 204 });
  });

  return calls;
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/recipes/${RECIPE.id}`]}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/" element={<p>Cookbook home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('favoriting from recipe detail', () => {
  it('flips immediately and sends the change', async () => {
    const calls = mockApi((call) =>
      call.method === 'PUT' && call.path.endsWith('/favorite')
        ? jsonResponse({
            userState: { favorite: true, rating: null },
            rating: { average: null, count: 0 },
          })
        : undefined,
    );
    renderDetail();

    const button = await screen.findByRole('button', {
      name: 'Add Weeknight Chili to your favorites',
    });
    await userEvent.click(button);

    expect(
      await screen.findByRole('button', { name: 'Remove Weeknight Chili from your favorites' }),
    ).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === 'PUT' && call.path === `/api/recipes/12/favorite`),
    ).toBe(true);
  });

  it('puts the heart back and says so when the change fails', async () => {
    mockApi((call) =>
      call.method === 'PUT' && call.path.endsWith('/favorite')
        ? jsonResponse(
            { error: { code: 'recipe_not_found', message: 'This recipe does not exist.', fields: {} } },
            404,
          )
        : undefined,
    );
    renderDetail();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add Weeknight Chili to your favorites' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('This recipe does not exist.');
    expect(
      screen.getByRole('button', { name: 'Add Weeknight Chili to your favorites' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('rating from recipe detail', () => {
  it('records a rating and takes the household average from the answer', async () => {
    const calls = mockApi((call) =>
      call.method === 'PUT' && call.path.endsWith('/rating')
        ? jsonResponse({
            userState: { favorite: false, rating: 4 },
            rating: { average: 4, count: 1 },
          })
        : undefined,
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('radio', { name: '4 stars' }));

    expect(await screen.findByText('4.0 average from 1 rating')).toBeInTheDocument();
    expect(
      calls.find((call) => call.method === 'PUT' && call.path === '/api/recipes/12/rating')?.body,
    ).toEqual({ rating: 4 });
  });

  it('offers to clear only once a rating exists, and clears it', async () => {
    const calls = mockApi((call) => {
      if (call.method === 'PUT' && call.path.endsWith('/rating')) {
        return jsonResponse({
          userState: { favorite: false, rating: 3 },
          rating: { average: 3, count: 1 },
        });
      }
      if (call.method === 'DELETE' && call.path.endsWith('/rating')) {
        return jsonResponse({
          userState: { favorite: false, rating: null },
          rating: { average: null, count: 0 },
        });
      }
      return undefined;
    });
    renderDetail();

    expect(await screen.findByRole('radio', { name: '3 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Clear/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '3 stars' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Clear/ }));

    expect(await screen.findByText('Not rated in this house yet')).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === 'DELETE' && call.path === '/api/recipes/12/rating'),
    ).toBe(true);
  });

  it('reverts the star and announces the error when rating fails', async () => {
    mockApi((call) =>
      call.method === 'PUT' && call.path.endsWith('/rating')
        ? jsonResponse(
            { error: { code: 'request_error', message: 'Could not save that.', fields: {} } },
            500,
          )
        : undefined,
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('radio', { name: '5 stars' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that.');
    expect(screen.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('recording a view', () => {
  it('reports the recipe as opened once it has loaded', async () => {
    const calls = mockApi();
    renderDetail();

    await screen.findByRole('heading', { name: 'Weeknight Chili' });

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'POST' && call.path === '/api/recipes/12/view'),
      ).toBe(true),
    );
  });

  it('does not report a view for a recipe that failed to load', async () => {
    const calls = mockApi((call) =>
      call.method === 'GET' && call.path === `/api/recipes/${RECIPE.id}`
        ? jsonResponse(
            { error: { code: 'recipe_not_found', message: 'This recipe does not exist.', fields: {} } },
            404,
          )
        : undefined,
    );
    renderDetail();

    await screen.findByText('This recipe does not exist.');

    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('favorites and recent screens', () => {
  it('lists favorites and invites browsing when there are none', async () => {
    mockApi((call) =>
      call.path.startsWith('/api/recipes?')
        ? jsonResponse({ items: [], nextCursor: null })
        : undefined,
    );

    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <FavoritesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No favorites yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse recipes' })).toBeInTheDocument();
  });

  it('asks for favorites only', async () => {
    const calls = mockApi((call) =>
      call.path.startsWith('/api/recipes?')
        ? jsonResponse({ items: [summary(1, 'Weeknight Chili')], nextCursor: null })
        : undefined,
    );

    render(
      <MemoryRouter initialEntries={['/favorites']}>
        <FavoritesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/api/recipes?favorite=true')).toBe(true);
  });

  it('shows recent history newest first, and explains an empty one', async () => {
    mockApi((call) => (call.path === '/api/recent' ? jsonResponse([]) : undefined));

    render(
      <MemoryRouter initialEntries={['/recent']}>
        <RecentPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('renders the recent list when there is history', async () => {
    mockApi((call) =>
      call.path === '/api/recent'
        ? jsonResponse([summary(2, 'Pancakes', false), summary(1, 'Weeknight Chili', false)])
        : undefined,
    );

    render(
      <MemoryRouter initialEntries={['/recent']}>
        <RecentPage />
      </MemoryRouter>,
    );

    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Pancakes',
      'Weeknight Chili',
    ]);
  });

  it('favorites straight from a card', async () => {
    const calls = mockApi((call) => {
      if (call.path === '/api/recent') return jsonResponse([summary(5, 'Pancakes', false)]);
      if (call.method === 'PUT' && call.path.endsWith('/favorite')) {
        return jsonResponse({
          userState: { favorite: true, rating: null },
          rating: { average: null, count: 0 },
        });
      }
      return undefined;
    });

    render(
      <MemoryRouter initialEntries={['/recent']}>
        <RecentPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add Pancakes to your favorites' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Remove Pancakes from your favorites' }),
    ).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === 'PUT' && call.path === '/api/recipes/5/favorite'),
    ).toBe(true);
  });
});
