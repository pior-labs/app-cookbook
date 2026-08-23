import { Hono, type Context } from 'hono';
import { imageEnv } from '../env.js';
import { ApiError, validationError } from '../errors.js';
import { isImageVariant, type ImageVariant } from '../images/transform.js';
import type { AppEnv } from '../middleware/context.js';
import { deleteRecipePhoto, readRecipePhoto, replaceRecipePhoto } from '../services/images.js';

// HTTP parsing and response mapping for the primary recipe photo
// (technical design section 7.4). Validation and transformation live in
// `images/`, and the service owns file/database ordering.

const PHOTO_FIELD = 'photo';

function photoError(message: string): ApiError {
  return validationError(message, { [PHOTO_FIELD]: [message] });
}

// Reject an oversized body before it is buffered, when the client declared its
// size. `processUpload` re-checks the actual bytes, because Content-Length is
// only a hint.
function assertDeclaredSizeAllowed(c: Context<AppEnv>): void {
  const declared = Number(c.req.header('content-length') ?? '');
  const { maxBytes } = imageEnv();

  // Multipart framing adds a little overhead on top of the file itself, so the
  // pre-check is deliberately loose; the exact limit is enforced on the decoded
  // part.
  if (Number.isFinite(declared) && declared > maxBytes + 1024 * 1024) {
    throw photoError(`This image is larger than ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
  }
}

async function readUploadedFile(c: Context<AppEnv>): Promise<Buffer> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw photoError('Send the photo as a multipart form upload.');
  }

  assertDeclaredSizeAllowed(c);

  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    throw photoError('This upload could not be read.');
  }

  const file = body[PHOTO_FIELD];
  if (!(file instanceof File)) {
    throw photoError('Choose a photo to upload.');
  }

  return Buffer.from(await file.arrayBuffer());
}

function variantParam(c: Context<AppEnv>): ImageVariant {
  const variant = c.req.param('variant');

  if (!variant || !isImageVariant(variant)) {
    throw photoError('Ask for the card or detail photo.');
  }

  return variant;
}

export function registerPhotoRoutes(route: Hono<AppEnv>, recipeIdParam: (c: Context<AppEnv>) => number) {
  route.put('/:id/photo', async (c) => {
    const recipeId = recipeIdParam(c);
    const source = await readUploadedFile(c);
    const image = await replaceRecipePhoto(recipeId, source, c.get('userId'), c.get('requestId'));

    return c.json(image);
  });

  route.get('/:id/photo/:variant', async (c) => {
    const recipeId = recipeIdParam(c);
    const variant = variantParam(c);
    const photo = await readRecipePhoto(recipeId, variant);

    // The variant bytes are immutable for a given content hash, so a changed
    // photo produces a new ETag rather than needing a cache bust. Caching is
    // private because delivery is authenticated and recipes are household data.
    const etag = `"${photo.contentHash}"`;
    c.header('ETag', etag);
    c.header('Cache-Control', 'private, max-age=0, must-revalidate');
    c.header('Content-Type', 'image/webp');

    if (c.req.header('if-none-match') === etag) {
      return c.body(null, 304);
    }

    c.header('Content-Length', String(photo.data.byteLength));

    return c.body(
      photo.data.buffer.slice(
        photo.data.byteOffset,
        photo.data.byteOffset + photo.data.byteLength,
      ) as ArrayBuffer,
    );
  });

  route.delete('/:id/photo', async (c) => {
    const recipeId = recipeIdParam(c);
    await deleteRecipePhoto(recipeId, c.get('requestId'));

    return c.body(null, 204);
  });
}
