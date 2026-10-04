import { Hono, type MiddlewareHandler } from 'hono';
import { IMPORT_IMAGE_MAX_BYTES, importRequestSchema } from '@cookbook/domain';
import type { AppEnv } from '../middleware/context.js';
import { importError } from '../import/fetch.js';
import { previewRecipeImage, previewRecipeImport } from '../services/imports.js';
import { parseBody } from './http.js';

export const importsRoute = new Hono<AppEnv>();
// Read the actual stream under a byte/time budget before parsing. A declared
// Content-Length is only a hint, including for multipart framing and fields.
function boundedBody(maxSize: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const reader = c.req.raw.body?.getReader();
    if (!reader) return next();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(importError('The upload took too long. Try again.'));
        void reader.cancel().catch(() => {});
      }, 30_000);
    });
    try {
      while (true) {
        const { done, value } = await Promise.race([reader.read(), timeout]);
        if (done) break;
        size += value.byteLength;
        if (size > maxSize) {
          void reader.cancel().catch(() => {});
          throw importError(
            'This import is too large. Use a shorter recipe or an image smaller than 10 MB.',
          );
        }
        chunks.push(value);
      }
      c.req.raw = new Request(c.req.raw, { body: Buffer.concat(chunks) });
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
    return next();
  };
}
importsRoute.post('/', boundedBody(180_000), async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(await previewRecipeImport(await parseBody(c, importRequestSchema)));
});
importsRoute.put('/image', boundedBody(IMPORT_IMAGE_MAX_BYTES + 64 * 1024), async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    throw importError('Choose a readable image to upload.');
  }
  const file = body.image;
  if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw importError('Choose a JPEG, PNG or WebP image.');
  if (file.size > IMPORT_IMAGE_MAX_BYTES) throw importError('Choose an image smaller than 10 MB.');
  c.header('Cache-Control', 'no-store');
  return c.json(await previewRecipeImage(Buffer.from(await file.arrayBuffer())));
});
