import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { imageEnv } from '../env.js';
import type { ImageVariant } from './transform.js';

// Filesystem side of recipe image storage (technical design section 8). Keys
// are generated and opaque: `<recipe-id>/<uuid>/<variant>.webp`. A user
// filename never becomes a path segment, and nothing outside the configured
// directory is ever read or written.

export function storageRoot(): string {
  return imageEnv().storageDir;
}

// One upload produces one directory holding both variants, so a replacement is
// a single directory to remove once the database reference has moved.
export function newImageFolder(recipeId: number): string {
  return `${recipeId}/${randomUUID()}`;
}

export function storageKey(folder: string, variant: ImageVariant): string {
  return `${folder}/${variant}.webp`;
}

export function contentHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// Defense in depth behind the generated keys: even if a key were ever tainted,
// it still cannot escape the storage root.
function absolutePath(key: string): string {
  const root = storageRoot();
  const full = resolve(root, key);

  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`Refusing to access an image path outside the storage root: ${key}`);
  }

  return full;
}

export async function ensureStorageRoot(): Promise<void> {
  await mkdir(storageRoot(), { recursive: true });
}

// Write to a temporary name in the destination directory and rename into place,
// so a reader never observes a partially written variant. The rename is atomic
// because both names live on the same filesystem.
export async function writeImageFile(key: string, data: Buffer): Promise<void> {
  const target = absolutePath(key);
  await mkdir(dirname(target), { recursive: true });

  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { mode: 0o640 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function readImageFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(absolutePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// Cleanup always runs after the database has committed, so a failure here
// leaves an orphaned file rather than a broken recipe. It is logged and left
// for the reconciliation command instead of failing the request.
export async function removeImageFolder(folder: string, requestId?: string): Promise<void> {
  try {
    await rm(absolutePath(folder), { recursive: true, force: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId: requestId ?? null,
        message: 'Failed to remove replaced image files',
        folder,
      }),
      error,
    );
  }
}

export function folderFromKey(key: string): string {
  return key.slice(0, key.lastIndexOf('/'));
}

// Every `<recipe-id>/<uuid>` folder currently on disk. Used by the orphan
// reconciliation command to diff the filesystem against `recipe_images`.
export async function listStoredFolders(): Promise<string[]> {
  const root = storageRoot();
  const folders: string[] = [];

  let recipeDirs: string[];
  try {
    recipeDirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  for (const recipeDir of recipeDirs) {
    const uploadDirs = await readdir(join(root, recipeDir), { withFileTypes: true });
    for (const upload of uploadDirs) {
      if (upload.isDirectory()) {
        folders.push(`${recipeDir}/${upload.name}`);
      }
    }
  }

  return folders;
}
