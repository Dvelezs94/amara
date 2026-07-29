import * as FileSystem from "expo-file-system/legacy";
import {
  hasEnoughDiskForDownload,
  isUpdateApkFileName,
  UPDATE_APK_SIZE_HINT_BYTES,
  updateApkDestinationUri,
} from "./update-download";

function ensureTrailingSlash(dir: string): string {
  return dir.endsWith("/") ? dir : `${dir}/`;
}

/** Deletes cached update APKs (fixed name + legacy timestamped files). */
export async function deleteCachedUpdateApks(
  baseDir: string,
  keepUri?: string | null
): Promise<number> {
  const dir = ensureTrailingSlash(baseDir);
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return 0;
  }
  const keep = keepUri?.trim() || null;
  let deleted = 0;
  await Promise.all(
    names.filter(isUpdateApkFileName).map(async (name) => {
      const uri = `${dir}${name}`;
      if (keep && uri === keep) return;
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        deleted += 1;
      } catch {
        // ignore individual delete failures
      }
    })
  );
  return deleted;
}

/**
 * Ensures free space for an APK download, clearing old update caches first.
 * Throws a user-facing Spanish message when space is insufficient.
 */
export async function assertDiskSpaceForUpdateDownload(
  baseDir: string,
  expectedDownloadBytes: number = UPDATE_APK_SIZE_HINT_BYTES
): Promise<void> {
  await deleteCachedUpdateApks(baseDir);
  let free: number | null = null;
  try {
    free = await FileSystem.getFreeDiskStorageAsync();
  } catch {
    free = null;
  }
  if (free != null && !hasEnoughDiskForDownload(free, expectedDownloadBytes)) {
    throw new Error(
      "No hay espacio suficiente en el dispositivo para descargar la actualizacion. Libera almacenamiento e intentalo de nuevo."
    );
  }
}

/** Destination URI for the next download (always the fixed cache file name). */
export function resolveUpdateApkLocalUri(baseDir: string): string {
  return updateApkDestinationUri(baseDir);
}

/** Best-effort remove of one downloaded APK after install or cancel. */
export async function deleteUpdateApkFile(uri: string | null | undefined): Promise<void> {
  const target = uri?.trim();
  if (!target) return;
  await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
}
