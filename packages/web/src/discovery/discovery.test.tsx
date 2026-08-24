import type { CategorySummary, HomeSections, RecipeSummary, TagSummary } from '@cookbook/domain';
import { screen, waitFor, within } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowsePage } from './BrowsePage.jsx';
import { HomePage } from './HomePage.jsx';

// Home discovery and browse/search behaviour (technical design sections 11.1,
// 11.3, and 14.3).

vi.mock('../auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.test' },
    loading: false,
    signOut: vi.fn(),
    startSignIn: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

function summary(id: number, name: string, overrides: Partial<RecipeSummary> = {}): RecipeSummary {
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
    userState: { favorite: false, rating: null },
    ...overrides,
  };
}

const CATEGORIES: CategorySummary[] = [
  {
    id: 1,
    name: 'Dinner',
    activeRecipeCount: 3,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Dessert',
    activeRecipeCount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const TAGS: TagSummary[] = [
  {
    id: 7,
    name: 'Weeknight',
    activeRecipeCount: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const EMPTY_HOME: HomeSections = {
  recentlyViewed: [],
  favorites: [],
  highlyRated: [],
  recentlyAdded: [],
  categories: CATEGORIES,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Routes each request by path so a test states what the API returns, not the
// order the screen happens to ask in.
type Handler = (url: URL) => Response | Promise<Response>;

function mockApi(handlers: Record<string, Handler>) {
  const calls: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const raw = typeof input === 'string' ? input : (input as Request).url;
    const url = new URL(raw, 'http://localhost');
    calls.push(url.pathname + url.search);

    const handler = handlers[url.pathname];
    if (!handler) throw new Error(`Unexpected request: ${raw}`);

    return handler(url);
  });

  return calls;
}

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={element} />
        <Route path="/recipes" element={element} />
        <Route path="/recipes/new" element={<p>New recipe</p>} />
        <Route path="/recipes/:id" element={<p>Recipe detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('home discovery', () => {
  it('shows only the sections that have something in them', async () => {
    mockApi({
      '/api/home': () =>
        jsonResponse({
          ...EMPTY_HOME,
          recentlyViewed: [summary(1, 'Weeknight Chili')],
          recentlyAdded: [summary(1, 'Weeknight Chili'), summary(2, 'Pancakes')],
        } satisfies HomeSections),
    });

    renderAt('/', <HomePage />);

    expect(await screen.findByRole('heading', { name: 'Jump back in' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently added' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your favorites' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Loved in this house' })).not.toBeInTheDocument();
  });

  it('links a used category into browse and leaves an unused one out', async () => {
    mockApi({
      '/api/home': () => jsonResponse({ ...EMPTY_HOME, recentlyAdded: [summary(1, 'Chili')] }),
    });

    renderAt('/', <HomePage />);

    const section = within(
      (await screen.findByRole('heading', { name: 'Browse by category' })).closest('section')!,
    );

    expect(section.getByRole('link', { name: /Dinner/ })).toHaveAttribute(
      'href',
      '/recipes?categoryId=1',
    );
    expect(section.queryByRole('link', { name: /Dessert/ })).not.toBeInTheDocument();
  });

  it('invites the first recipe when the cookbook is empty', async () => {
    mockApi({ '/api/home': () => jsonResponse(EMPTY_HOME) });

    renderAt('/', <HomePage />);

    expect(await screen.findByText('Nothing on the shelf yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a recipe' })).toBeInTheDocument();
  });

  it('offers retry after a network error and recovers', async () => {
    let attempt = 0;
    mockApi({
      '/api/home': () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError('network down');
        return jsonResponse({ ...EMPTY_HOME, recentlyAdded: [summary(1, 'Weeknight Chili')] });
      },
    });

    renderAt('/', <HomePage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
  });
});

describe('browse and search', () => {
  const organization: Record<string, Handler> = {
    '/api/categories': () => jsonResponse(CATEGORIES),
    '/api/tags': () => jsonResponse(TAGS),
  };

  it('searches on what was typed and keeps the query in the box', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': (url) =>
        jsonResponse({
          items: url.searchParams.get('q') === 'chili' ? [summary(1, 'Weeknight Chili')] : [],
          nextCursor: null,
        }),
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.type(await screen.findByLabelText('Search recipes'), 'chili');

    expect(await screen.findByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search recipes')).toHaveValue('chili');
    expect(calls.some((call) => call === '/api/recipes?q=chili')).toBe(true);
  });

  it('sends a category, a tag, and a time filter together', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': () => jsonResponse({ items: [summary(1, 'Chili')], nextCursor: null }),
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.selectOptions(await screen.findByLabelText('Category'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Weeknight', pressed: false }));
    await userEvent.click(screen.getByRole('button', { name: '30 min or less' }));

    await waitFor(() => {
      expect(calls.at(-1)).toBe('/api/recipes?categoryId=1&tagId=7&maxTotalMinutes=30');
    });
  });

  it('starts from the filters already in the URL', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': () => jsonResponse({ items: [summary(1, 'Chili')], nextCursor: null }),
    });

    renderAt('/recipes?q=chili&sort=name', <BrowsePage />);

    expect(await screen.findByLabelText('Search recipes')).toHaveValue('chili');
    expect(await screen.findByLabelText('Sort')).toHaveValue('name');
    expect(calls).toContain('/api/recipes?q=chili&sort=name');
  });

  it('keeps the query and offers a clear action when nothing matches', async () => {
    mockApi({
      ...organization,
      '/api/recipes': () => jsonResponse({ items: [], nextCursor: null }),
    });

    renderAt('/recipes?q=anchovy', <BrowsePage />);

    expect(await screen.findByText('Nothing matches that yet.')).toBeInTheDocument();
    expect(screen.getByLabelText('Search recipes')).toHaveValue('anchovy');

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);

    expect(screen.getByLabelText('Search recipes')).toHaveValue('');
  });

  it('appends the next page instead of replacing the results', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': (url) =>
        url.searchParams.get('cursor')
          ? jsonResponse({ items: [summary(2, 'Pancakes')], nextCursor: null })
          : jsonResponse({ items: [summary(1, 'Weeknight Chili')], nextCursor: 'page-2' }),
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(calls).toContain('/api/recipes?cursor=page-2');
  });

  it('discards loaded pages when the filters change', async () => {
    mockApi({
      ...organization,
      '/api/recipes': (url) => {
        if (url.searchParams.get('categoryId') === '2') {
          return jsonResponse({ items: [summary(3, 'Brownies')], nextCursor: null });
        }
        return url.searchParams.get('cursor')
          ? jsonResponse({ items: [summary(2, 'Pancakes')], nextCursor: null })
          : jsonResponse({ items: [summary(1, 'Weeknight Chili')], nextCursor: 'page-2' });
      },
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Category'), '2');

    expect(await screen.findByRole('heading', { name: 'Brownies' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pancakes' })).not.toBeInTheDocument();
  });

  it('recovers from a stale cursor by explaining and offering retry', async () => {
    mockApi({
      ...organization,
      '/api/recipes': (url) =>
        url.searchParams.get('cursor')
          ? jsonResponse(
              {
                error: {
                  code: 'validation_error',
                  message: 'That page link is no longer valid.',
                  fields: { cursor: ['Start from the first page of results.'] },
                },
              },
              400,
            )
          : jsonResponse({ items: [summary(1, 'Weeknight Chili')], nextCursor: 'stale' }),
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That page link is no longer valid.');
    // The first page is still on screen: a failed "load more" must not throw
    // away results a cook is already reading.
    expect(screen.getByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
  });

  it('filters to favorites and a minimum household rating', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': () => jsonResponse({ items: [summary(1, 'Chili')], nextCursor: null }),
    });

    renderAt('/recipes', <BrowsePage />);

    await userEvent.click(await screen.findByRole('button', { name: 'My favorites' }));
    await userEvent.click(screen.getByRole('button', { name: '4★' }));

    await waitFor(() => expect(calls.at(-1)).toBe('/api/recipes?favorite=true&minRating=4'));
  });

  it('clears every filter but keeps the chosen sort', async () => {
    const calls = mockApi({
      ...organization,
      '/api/recipes': () => jsonResponse({ items: [summary(1, 'Chili')], nextCursor: null }),
    });

    renderAt('/recipes?q=chili&favorite=true&minRating=4&sort=name', <BrowsePage />);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Clear filters' }))[0]);

    await waitFor(() => expect(calls.at(-1)).toBe('/api/recipes?sort=name'));
    expect(screen.getByLabelText('Search recipes')).toHaveValue('');
    expect(screen.getByLabelText('Sort')).toHaveValue('name');
  });

  it('reports how many recipes matched', async () => {
    mockApi({
      ...organization,
      '/api/recipes': () =>
        jsonResponse({ items: [summary(1, 'Chili'), summary(2, 'Pancakes')], nextCursor: null }),
    });

    renderAt('/recipes', <BrowsePage />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 recipes'));
  });

  it('labels every result card with its category and time', async () => {
    mockApi({
      ...organization,
      '/api/recipes': () =>
        jsonResponse({
          items: [summary(1, 'Weeknight Chili', { rating: { average: 4.5, count: 2 } })],
          nextCursor: null,
        }),
    });

    renderAt('/recipes', <BrowsePage />);

    const card = (await screen.findByRole('heading', { name: 'Weeknight Chili' })).closest('li')!;
    expect(within(card).getByText('Dinner')).toBeInTheDocument();
    expect(within(card).getByText('30 min')).toBeInTheDocument();
    expect(within(card).getByText('4.5')).toBeInTheDocument();
    expect(within(card).getByText('(2)')).toBeInTheDocument();
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/recipes/1');
  });
});
