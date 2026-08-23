import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStorageRoot, storageRoot } from './storage.js';

// A production API container without a writable image mount can still serve
// recipes but silently fails every upload, so readiness proves the directory is
// actually writable rather than merely present.
export async function checkStorageWritable(): Promise<boolean> {
  const probe = join(storageRoot(), `.readiness-${randomUUID()}`);

  try {
    await ensureStorageRoot();
    await writeFile(probe, '');
    return true;
  } catch (error) {
    console.error('Image storage readiness check failed', error);
    return false;
  } finally {
    await rm(probe, { force: true }).catch(() => {});
  }
}
