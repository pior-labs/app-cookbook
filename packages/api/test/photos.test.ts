import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RecipeDetail, RecipeImage } from '@cookbook/domain';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, db } from '../src/db/index.js';
import { recipeImages } from '../src/db/schema.js';
import { listStoredFolders, storageRoot } from '../src/images/storage.js';
import { reconcileImages } from '../src/images/reconcile.js';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Integration coverage for multipart image validation, replacement, delivery,
// and cleanup against a disposable image directory (technical design
// section 14.2).

const app: AppUnderTest = createTestApp();

let user: { id: number };
let client: TestClient;
let recipe: RecipeDetail;

async function jpeg(width = 1400, height = 1000): Promise<Blob> {
  const data = await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg()
    .toBuffer();

  return new Blob([data], { type: 'image/jpeg' });
}

async function png(width = 600, height = 400): Promise<Blob> {
  const data = await sharp({
    create: { width, height, channels: 4, background: { r: 20, g: 120, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return new Blob([data], { type: 'image/png' });
}

async function createRecipe(): Promise<RecipeDetail> {
  const response = await client.post('/api/recipes', {
    name: 'Weeknight Chili',
    description: 'A one-pot chili the household actually finishes.',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    ingredients: [{ name: 'Ground beef', quantity: '1 1/2', unitCode: 'lb' }],
    instructions: [{ body: 'Brown the beef.' }],
  });

  expect(response.status).toBe(201);
  return (await response.json()) as RecipeDetail;
}

async function uploadPhoto(file?: Blob): Promise<RecipeImage> {
  const response = await client.putFile(`/api/recipes/${recipe.id}/photo`, file ?? (await jpeg()));
  expect(response.status).toBe(200);
  return (await response.json()) as RecipeImage;
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  client = asUser(app, user.id);
  recipe = await createRecipe();
});

describe('photo upload', () => {
  it('stores card and detail WebP variants and reports their dimensions', async () => {
    const image = await uploadPhoto();

    expect(image).toMatchObject({
      cardUrl: `/api/recipes/${recipe.id}/photo/card`,
      detailUrl: `/api/recipes/${recipe.id}/photo/detail`,
    });
    // The 1400px-wide source is capped at the detail width and downscaled again
    // for the card, both preserving the 1.4 aspect ratio.
    expect(image.detailWidth).toBe(1400);
    expect(image.cardWidth).toBe(800);
    expect(image.cardHeight).toBe(571);

    const card = await client.get(image.cardUrl);
    expect(card.status).toBe(200);
    expect(card.headers.get('content-type')).toBe('image/webp');

    const decoded = await sharp(Buffer.from(await card.arrayBuffer())).metadata();
    expect(decoded.format).toBe('webp');
    expect(decoded.width).toBe(800);
  });

  it('does not upscale a source smaller than the variant width', async () => {
    const image = await uploadPhoto(await png(600, 400));

    expect(image.cardWidth).toBe(600);
    expect(image.detailWidth).toBe(600);
  });

  it('records verified source metadata rather than the declared type', async () => {
    // The blob claims JPEG; the bytes are a PNG. The decoded format wins.
    const pngBytes = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();

    const response = await client.putFile(
      `/api/recipes/${recipe.id}/photo`,
      new Blob([pngBytes], { type: 'image/jpeg' }),
      'not-really.jpg',
    );
    expect(response.status).toBe(200);

    const row = await db.query.recipeImages.findFirst({
      where: eq(recipeImages.recipeId, recipe.id),
    });
    expect(row?.sourceMediaType).toBe('image/png');
    expect(row?.sourceByteSize).toBe(pngBytes.byteLength);
    expect(row?.uploadedByUserId).toBe(user.id);
  });

  it('never puts the uploaded filename in the storage key', async () => {
    const response = await client.putFile(
      `/api/recipes/${recipe.id}/photo`,
      await jpeg(),
      '../../escape .jpg',
    );
    expect(response.status).toBe(200);

    const row = await db.query.recipeImages.findFirst({
      where: eq(recipeImages.recipeId, recipe.id),
    });
    expect(row?.cardStorageKey).toMatch(
      new RegExp(`^${recipe.id}/[0-9a-f-]{36}/card\\.webp$`),
    );
    expect(row?.detailStorageKey).toContain('/detail.webp');
    expect(row?.cardStorageKey).not.toContain('escape');
  });

  it('exposes the photo through the recipe aggregate', async () => {
    await uploadPhoto();

    const response = await client.get(`/api/recipes/${recipe.id}`);
    const detail = (await response.json()) as RecipeDetail;

    expect(detail.hasImage).toBe(true);
    expect(detail.image?.detailUrl).toBe(`/api/recipes/${recipe.id}/photo/detail`);
  });

  it('rejects a file that is not a decodable image', async () => {
    const response = await client.putFile(
      `/api/recipes/${recipe.id}/photo`,
      new Blob([Buffer.from('this is not an image')], { type: 'image/jpeg' }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; fields: Record<string, string[]> } };
    expect(body.error.code).toBe('validation_error');
    expect(body.error.fields.photo).toBeDefined();
  });

  it('rejects a decodable image in an unsupported format', async () => {
    const tiff = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#ffffff' },
    })
      .tiff()
      .toBuffer();

    const response = await client.putFile(
      `/api/recipes/${recipe.id}/photo`,
      new Blob([tiff], { type: 'image/tiff' }),
      'photo.tiff',
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('JPEG, PNG, or WebP');
  });

  it('rejects an upload that is not multipart', async () => {
    const response = await client.put(`/api/recipes/${recipe.id}/photo`, { photo: 'nope' });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('multipart');
  });

  it('rejects a multipart body without the photo field', async () => {
    const response = await client.putFile(
      `/api/recipes/${recipe.id}/photo`,
      await jpeg(),
      'photo.jpg',
      'attachment',
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 for a recipe that does not exist', async () => {
    const response = await client.putFile('/api/recipes/999999/photo', await jpeg());

    expect(response.status).toBe(404);
  });

  it('requires authentication', async () => {
    const response = await asUser(app, null).putFile(
      `/api/recipes/${recipe.id}/photo`,
      await jpeg(),
    );

    expect(response.status).toBe(401);
  });
});

describe('photo delivery', () => {
  it('revalidates with a content-hash ETag and caches privately', async () => {
    const image = await uploadPhoto();

    const first = await client.get(image.detailUrl);
    const etag = first.headers.get('etag');

    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(first.headers.get('cache-control')).toContain('private');

    const revalidated = await client.get(image.detailUrl, { 'if-none-match': etag as string });
    expect(revalidated.status).toBe(304);
    expect(await revalidated.arrayBuffer()).toHaveProperty('byteLength', 0);
  });

  it('changes the ETag when the photo is replaced', async () => {
    const first = await uploadPhoto(await jpeg(1400, 1000));
    const firstEtag = (await client.get(first.cardUrl)).headers.get('etag');

    await uploadPhoto(await png(900, 900));
    const secondEtag = (await client.get(first.cardUrl)).headers.get('etag');

    expect(secondEtag).not.toBe(firstEtag);
  });

  it('rejects an unknown variant', async () => {
    await uploadPhoto();

    const response = await client.get(`/api/recipes/${recipe.id}/photo/original`);
    expect(response.status).toBe(400);
  });

  it('returns 404 when the recipe has no photo', async () => {
    const response = await client.get(`/api/recipes/${recipe.id}/photo/card`);

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('recipe_photo_not_found');
  });

  it('requires authentication', async () => {
    const image = await uploadPhoto();
    const response = await asUser(app, null).get(image.cardUrl);

    expect(response.status).toBe(401);
  });
});

describe('photo replacement and cleanup', () => {
  it('keeps one image row and removes the replaced files', async () => {
    await uploadPhoto(await jpeg(1400, 1000));
    const [firstFolder] = await listStoredFolders();

    const replaced = await uploadPhoto(await png(900, 900));

    const rows = await db.select().from(recipeImages).where(eq(recipeImages.recipeId, recipe.id));
    expect(rows).toHaveLength(1);
    expect(replaced.cardWidth).toBe(800);

    const folders = await listStoredFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]).not.toBe(firstFolder);

    // The served bytes come from the new upload, not the removed one.
    const card = await client.get(replaced.cardUrl);
    expect(card.status).toBe(200);
  });

  it('deletes the photo and its files', async () => {
    await uploadPhoto();

    const response = await client.delete(`/api/recipes/${recipe.id}/photo`);
    expect(response.status).toBe(204);

    expect(await listStoredFolders()).toHaveLength(0);
    expect(
      await db.select().from(recipeImages).where(eq(recipeImages.recipeId, recipe.id)),
    ).toHaveLength(0);

    expect((await client.get(`/api/recipes/${recipe.id}/photo/card`)).status).toBe(404);
  });

  it('returns 404 when deleting a photo that is not there', async () => {
    expect((await client.delete(`/api/recipes/${recipe.id}/photo`)).status).toBe(404);
  });

  it('leaves no temporary files behind', async () => {
    await uploadPhoto();
    const [folder] = await listStoredFolders();

    const files = await readdir(`${storageRoot()}/${folder}`);
    expect(files.sort()).toEqual(['card.webp', 'detail.webp']);
  });
});

describe('orphan reconciliation', () => {
  it('reports a clean directory as having nothing to do', async () => {
    await uploadPhoto();

    const report = await reconcileImages();

    expect(report.referencedFolders).toBe(1);
    expect(report.orphanedFolders).toEqual([]);
    expect(report.missingKeys).toEqual([]);
  });

  it('finds and removes files no longer referenced by any recipe', async () => {
    await uploadPhoto();
    const [folder] = await listStoredFolders();

    // Stands in for cleanup that failed after the database committed.
    await db.delete(recipeImages).where(eq(recipeImages.recipeId, recipe.id));

    const dryRun = await reconcileImages();
    expect(dryRun.orphanedFolders).toEqual([folder]);
    expect(dryRun.removed).toBe(false);
    expect(await listStoredFolders()).toHaveLength(1);

    const deleted = await reconcileImages({ removeOrphans: true });
    expect(deleted.orphanedFolders).toEqual([folder]);
    expect(await listStoredFolders()).toHaveLength(0);
  });

  it('reports metadata whose files are missing without discarding it', async () => {
    await uploadPhoto();
    const [folder] = await listStoredFolders();

    // Storage that came back from a restore incomplete: the row still points at
    // files that are not there.
    await rm(`${storageRoot()}/${folder}`, { recursive: true, force: true });

    const report = await reconcileImages({ removeOrphans: true });

    expect(report.missingKeys).toHaveLength(2);
    expect(report.orphanedFolders).toEqual([]);
    // Reconciliation only ever removes files, so the recipe keeps its photo
    // metadata and the operator can restore the directory.
    expect(
      await db.select().from(recipeImages).where(eq(recipeImages.recipeId, recipe.id)),
    ).toHaveLength(1);
    expect((await client.get(`/api/recipes/${recipe.id}/photo/card`)).status).toBe(404);
  });
});

describe('readiness', () => {
  it('reports the image directory alongside the database', async () => {
    const response = await app.request('/api/readiness');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ready',
      database: 'connected',
      imageStorage: 'writable',
    });
  });

  it('is not ready when the image directory cannot be written', async () => {
    const configured = process.env.IMAGE_STORAGE_DIR as string;
    // A directory cannot be created underneath a regular file, which is what an
    // unmounted or misconfigured production volume looks like.
    const blocker = join(configured, 'blocked');
    await mkdir(configured, { recursive: true });
    await writeFile(blocker, '');
    process.env.IMAGE_STORAGE_DIR = join(blocker, 'images');

    try {
      const response = await app.request('/api/readiness');

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        status: 'not_ready',
        imageStorage: 'unavailable',
      });
    } finally {
      process.env.IMAGE_STORAGE_DIR = configured;
      await rm(blocker, { force: true });
    }
  });
});
