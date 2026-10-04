import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recipeImportDraftSchema } from '@cookbook/domain';
import { extractRecipePage } from './extract.js';
import { fetchRecipePage, isPublicAddress, publicPageUrl, resolvePublicAddress } from './fetch.js';
import { normalizeImport, prepareImportImage } from './normalize.js';

const network = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn() }));
vi.mock('node:http', () => ({ request: network.request }));
vi.mock('node:https', () => ({ request: network.request }));
vi.mock('node:dns/promises', () => ({ lookup: network.lookup }));
afterEach(() => vi.clearAllMocks());
const recipe = {
  name: 'Soup',
  description: '',
  baseServings: null,
  prepMinutes: null,
  cookMinutes: null,
  notes: null,
  ingredients: [
    {
      name: 'salt',
      quantity: null,
      unitCode: null,
      unitText: null,
      preparation: 'to taste',
      originalText: 'salt to taste',
    },
  ],
  instructions: [{ body: 'Simmer.' }],
  warnings: [],
};
function provider(value: unknown) {
  return vi
    .fn()
    .mockResolvedValue({ value, model: 'test', inputTokens: 0, outputTokens: 0, latencyMs: 1 });
}
function respond(status: number, headers: Record<string, string>, body: string) {
  network.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const response = Object.assign(new PassThrough(), { statusCode: status, headers });
      callback(response);
      if (!response.destroyed) response.end(body);
    };
    return req;
  });
}

describe('public-page fetch boundary', () => {
  it.each([
    '127.0.0.1',
    '0.0.0.0',
    '10.0.0.1',
    '172.16.1.2',
    '192.168.1.1',
    '169.254.169.254',
    '100.100.100.200',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:8.8.8.8',
    '2001:db8::1',
  ])('blocks %s', (address) => expect(isPublicAddress(address)).toBe(false));
  it.each([
    'file:///etc/passwd',
    'http://user:pass@example.com',
    'http://localhost',
    'http://127.1',
    'http://0x7f000001',
    'http://2130706433',
    'https://example.com:3002',
    'http://[::ffff:127.0.0.1]',
  ])('rejects unsafe URL %s', (url) => expect(() => publicPageUrl(url)).toThrow());
  it('rejects any private DNS answer and pins the public one', async () => {
    await expect(
      resolvePublicAddress(new URL('https://example.com'), async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow('private');
    network.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    respond(200, { 'content-type': 'text/html' }, '<h1>Soup</h1>');
    expect(await fetchRecipePage('https://example.com')).toMatchObject({ html: '<h1>Soup</h1>' });
    const options = network.request.mock.calls[0][1];
    const callback = vi.fn();
    options.lookup('example.com', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4);
    expect(options).toMatchObject({ agent: false });
    options.lookup('example.com', { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });
  it('blocks private redirect targets before another request', async () => {
    network.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    respond(302, { location: 'http://169.254.169.254/latest/meta-data' }, '');
    await expect(fetchRecipePage('https://example.com')).rejects.toThrow('private');
    expect(network.request).toHaveBeenCalledTimes(1);
  });
  it('rechecks DNS after a redirect and rejects rebinding', async () => {
    network.lookup
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    respond(302, { location: '/recipe' }, '');
    await expect(fetchRecipePage('https://example.com')).rejects.toThrow('private');
    expect(network.request).toHaveBeenCalledTimes(1);
  });
  it('bounds response bytes even without Content-Length', async () => {
    network.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    respond(200, { 'content-type': 'text/html' }, 'x'.repeat(2 * 1024 * 1024 + 1));
    await expect(fetchRecipePage('https://example.com')).rejects.toThrow('too large');
  });
  it('rejects blocked and non-HTML responses', async () => {
    network.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    respond(403, {}, 'Blocked');
    await expect(fetchRecipePage('https://example.com')).rejects.toThrow('could not be opened');
    respond(200, { 'content-type': 'application/pdf' }, 'PDF');
    await expect(fetchRecipePage('https://example.com')).rejects.toThrow('not a supported');
  });
});

describe('extraction and honest drafts', () => {
  it('reads nested Recipe metadata, ordered sections and the photo, removing scripts and nav from text', () => {
    const data = {
      '@graph': [
        {
          '@type': ['Recipe'],
          name: 'Soup',
          recipeIngredient: ['1 cup water'],
          recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ text: 'Boil.' }] }],
          image: { url: '/soup.jpg' },
          tracking: 'private',
        },
      ],
    };
    const extracted = extractRecipePage(
      `<script type="application/ld+json">${JSON.stringify(data)}</script><nav>junk</nav><main><h1>Soup</h1><p>Serves 2</p><script>ignore</script></main>`,
    );
    expect(extracted.metadata[0]).toMatchObject({
      name: 'Soup',
      recipeIngredient: ['1 cup water'],
    });
    expect(JSON.stringify(extracted)).not.toContain('tracking');
    expect(extracted.imageUrl).toBe('/soup.jpg');
    expect(extracted.text).toContain('Serves 2');
    expect(extracted.text).not.toMatch(/junk|ignore/);
  });
  it('falls back to readable text when metadata is malformed', () => {
    expect(
      extractRecipePage(
        '<script type="application/ld+json">{bad</script><article>Soup &amp; bread</article>',
      ).text,
    ).toBe('Soup & bread');
  });
  it('keeps servings and quantities unknown and asks for review', async () => {
    const model = provider(recipe);
    const draft = await normalizeImport({ text: 'salt to taste' }, undefined, model);
    expect(draft.baseServings).toBeNull();
    expect(draft.ingredients[0]).toMatchObject({ quantity: null, originalText: 'salt to taste' });
    expect(draft.warnings.map((warning) => warning.field)).toEqual([
      'baseServings',
      'ingredients.0.quantity',
    ]);
    expect(model.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-luna' });
  });
  it('clears ambiguous amounts rather than turning them into numbers', async () => {
    const draft = await normalizeImport(
      {},
      undefined,
      provider({ ...recipe, ingredients: [{ ...recipe.ingredients[0], quantity: '1-2' }] }),
    );
    expect(draft.ingredients[0].quantity).toBeNull();
  });
  it('clears a model guess when the same amount is flagged uncertain', async () => {
    const draft = await normalizeImport(
      {},
      undefined,
      provider({
        ...recipe,
        ingredients: [{ ...recipe.ingredients[0], quantity: '2' }],
        warnings: [{ field: 'ingredients.0.quantity', message: 'Amount is partly cropped.' }],
      }),
    );
    expect(draft.ingredients[0].quantity).toBeNull();
  });
  it('can return a warning for every ingredient without breaking the MCP preview schema', async () => {
    const draft = await normalizeImport(
      {},
      undefined,
      provider({
        ...recipe,
        ingredients: Array.from({ length: 200 }, () => ({ ...recipe.ingredients[0] })),
      }),
    );
    expect(draft.warnings.length).toBeGreaterThan(100);
    expect(
      recipeImportDraftSchema.safeParse({
        ...draft,
        importMethod: 'text',
        sourceUrl: null,
        photoDataUrl: null,
        duplicates: [],
      }).success,
    ).toBe(true);
  });
  it('rejects malformed output, no recipe and provider failures', async () => {
    await expect(
      normalizeImport({}, undefined, provider({ ...recipe, extra: 'bad' })),
    ).rejects.toThrow('safely');
    await expect(
      normalizeImport({}, undefined, provider({ ...recipe, ingredients: [], instructions: [] })),
    ).rejects.toThrow('No readable recipe');
    await expect(
      normalizeImport({}, undefined, vi.fn().mockRejectedValue(new Error('secret'))),
    ).rejects.toThrow('unavailable');
  });
  it('decodes screenshots in memory and rejects fake/unsupported images', async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    expect(await prepareImportImage(png)).toMatch(/^data:image\/png;base64,/);
    await expect(prepareImportImage(Buffer.from('not an image'))).rejects.toThrow(
      'could not be read',
    );
    await expect(prepareImportImage(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow('10 MB');
    await expect(
      prepareImportImage(Buffer.from('<svg width="10" height="10"></svg>')),
    ).rejects.toThrow('could not be read');
  });
});
