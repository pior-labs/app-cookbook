import { closeDatabase, db } from '../db/index.js';
import { listReferencedStorageKeys } from '../repositories/index.js';
import { folderFromKey, listStoredFolders, removeImageFolder, storageRoot } from './storage.js';

// Reconciles the image directory against `recipe_images`. File cleanup is best-
// effort and runs after the database commits, so an interrupted replacement or
// permanent deletion can leave files behind. This is the repair path for that,
// and the validation path after a restore.
//
// It only ever removes files, never database rows: metadata pointing at a
// missing file means storage is incomplete, which is a restore problem a
// maintenance command must not "fix" by discarding the recipe's photo.

export interface ReconcileReport {
  storageDir: string;
  storedFolders: number;
  referencedFolders: number;
  orphanedFolders: string[];
  missingKeys: string[];
  removed: boolean;
}

export async function reconcileImages(
  options: { removeOrphans: boolean } = { removeOrphans: false },
): Promise<ReconcileReport> {
  const referencedKeys = await listReferencedStorageKeys(db);
  const referencedFolders = new Set(referencedKeys.map(folderFromKey));
  const storedFolders = await listStoredFolders();

  const orphanedFolders = storedFolders.filter((folder) => !referencedFolders.has(folder));
  const storedSet = new Set(storedFolders);
  const missingKeys = referencedKeys.filter((key) => !storedSet.has(folderFromKey(key)));

  if (options.removeOrphans) {
    for (const folder of orphanedFolders) {
      await removeImageFolder(folder);
    }
  }

  return {
    storageDir: storageRoot(),
    storedFolders: storedFolders.length,
    referencedFolders: referencedFolders.size,
    orphanedFolders,
    missingKeys,
    removed: options.removeOrphans,
  };
}

// `pnpm images:reconcile` reports only; `--delete` acts. Defaulting to a dry run
// keeps an accidental invocation from deleting files that a partially restored
// database has not yet claimed.
async function main(): Promise<void> {
  const removeOrphans = process.argv.includes('--delete');
  const report = await reconcileImages({ removeOrphans });

  console.log(JSON.stringify(report, null, 2));

  if (!removeOrphans && report.orphanedFolders.length > 0) {
    console.log(`\nRe-run with --delete to remove ${report.orphanedFolders.length} orphaned folder(s).`);
  }

  // Missing files are the direction that means storage came back incomplete -
  // usually a database and an image archive restored from different points in
  // time (OPERATIONS.md section 4). Exit non-zero so a restore check that reads
  // the status, not the output, fails instead of reporting a good restore.
  //
  // `exitCode` rather than `exit()`: the report above still has to flush and the
  // pool still has to close, and `process.exit()` would cut both short.
  if (report.missingKeys.length > 0) {
    console.error(
      `\n${report.missingKeys.length} referenced image file(s) are missing from ${report.storageDir}.`,
    );
    process.exitCode = 1;
  }

  await closeDatabase();
}

// Only when run directly, so importing the reconciler from a test or another
// module does not execute the command.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
