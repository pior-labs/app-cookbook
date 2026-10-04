import { importRequestSchema, normalizeName, type RecipeImportDraft } from '@cookbook/domain';
import sharp from 'sharp';
import { db } from '../db/index.js';
import { findImportDuplicates } from '../repositories/recipes.js';
import { zodValidationError } from '../errors.js';
import { extractRecipePage } from '../import/extract.js';
import { fetchPublicResource, fetchRecipePage, publicPageUrl } from '../import/fetch.js';
import { normalizeImport, prepareImportImage } from '../import/normalize.js';

// Preview is intentionally read-only. No recipe, draft, screenshot or image
// file exists until the caller explicitly saves through the recipe service.
// Attribution comes from the input, never from a model-generated URL.
export async function previewRecipeImport(
  raw: unknown,
  options: { includePhoto?: boolean } = {},
): Promise<RecipeImportDraft> {
  const parsed = importRequestSchema.safeParse(raw);
  if (!parsed.success) throw zodValidationError(parsed.error);
  const input = parsed.data;
  let content: unknown;
  let sourceUrl: string | null = null;
  let photoUrl: string | null = null;
  if (input.method === 'url') {
    sourceUrl = publicPageUrl(input.url).href;
    const page = await fetchRecipePage(sourceUrl);
    const extracted = extractRecipePage(page.html);
    content = { metadata: extracted.metadata, text: extracted.text };
    if (extracted.imageUrl) {
      try {
        photoUrl = new URL(extracted.imageUrl, page.url).href;
      } catch {
        /* Optional photo must never cost the draft. */
      }
    }
  } else content = { text: input.text };
  const result = await normalizeImport(content);
  let photoDataUrl: string | null = null;
  if (photoUrl && options.includePhoto !== false) {
    try {
      const photo = await fetchPublicResource(photoUrl, true);
      // Re-encode, strip metadata and bound dimensions before returning bytes.
      // The browser holds this optional photo until save, like the draft itself.
      const safe = await prepareImportImage(photo.data);
      const data = await sharp(Buffer.from(safe.split(',')[1], 'base64'))
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      photoDataUrl = `data:image/webp;base64,${data.toString('base64')}`;
    } catch {
      result.warnings.push({
        field: 'photo',
        message: 'The page photo could not be imported. You can add a photo after saving.',
      });
    }
  }
  return {
    ...result,
    importMethod: input.method,
    sourceUrl,
    photoDataUrl,
    duplicates: await findImportDuplicates(db, normalizeName(result.name), sourceUrl),
  };
}

export async function previewRecipeImage(source: Buffer): Promise<RecipeImportDraft> {
  const image = await prepareImportImage(source);
  const result = await normalizeImport({ source: 'One uploaded recipe screenshot' }, image);
  return {
    ...result,
    importMethod: 'image',
    sourceUrl: null,
    photoDataUrl: null,
    duplicates: await findImportDuplicates(db, normalizeName(result.name), null),
  };
}
