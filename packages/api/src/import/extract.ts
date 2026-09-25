import { load } from 'cheerio';
import { importError } from './fetch.js';

// Whitelist recipe fields so trackers, comments and unrelated schema payloads
// never consume model context. A text fallback accompanies incomplete metadata.
const RECIPE_FIELDS = [
  'name',
  'description',
  'recipeYield',
  'recipeIngredient',
  'recipeInstructions',
  'prepTime',
  'cookTime',
  'totalTime',
] as const;
export function extractRecipePage(html: string): {
  metadata: unknown[];
  text: string;
  imageUrl: string | null;
} {
  const $ = load(html);
  const recipes: Record<string, unknown>[] = [];
  let imageUrl: string | null = null;
  function imageLink(value: unknown, depth = 0): string | null {
    if (depth > 20) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return imageLink(value[0], depth + 1);
    if (value && typeof value === 'object')
      return imageLink(
        (value as Record<string, unknown>).url ?? (value as Record<string, unknown>).contentUrl,
        depth + 1,
      );
    return null;
  }
  function visit(value: unknown, depth = 0): void {
    if (depth > 20 || recipes.length >= 5 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (
      types.some(
        (type) =>
          type === 'Recipe' ||
          type === 'https://schema.org/Recipe' ||
          type === 'http://schema.org/Recipe',
      )
    ) {
      if (!recipes.length) imageUrl = imageLink(object.image);
      recipes.push(
        Object.fromEntries(
          RECIPE_FIELDS.filter((key) => key in object).map((key) => [key, object[key]]),
        ),
      );
      return;
    }
    for (const child of Object.values(object)) visit(child, depth + 1);
  }
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      /* Broken metadata must not hide readable text. */
    }
  });
  $(
    'script, style, noscript, nav, footer, header, aside, form, [hidden], [aria-hidden="true"]',
  ).remove();
  $('br, p, li, h1, h2, h3, h4, section').each((_index, element) => {
    $(element).append('\n');
  });
  const relevant = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('body');
  const text = relevant
    .text()
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 40_000);
  // Discard oversized metadata instead of truncating JSON into a misleading
  // partial ingredient. Visible text can still produce an honest partial draft.
  const metadata = recipes
    .filter((recipe) => {
      try {
        return JSON.stringify(recipe).length <= 30_000;
      } catch {
        return false;
      } // Excessively nested metadata is no better than malformed JSON.
    })
    .slice(0, 1);
  if (!text && !metadata.length)
    throw importError(
      'No recipe content was found. Try another page or upload a readable screenshot.',
    );
  imageUrl ??= $('meta[property="og:image"]').attr('content') ?? null;
  return { metadata, text, imageUrl };
}
