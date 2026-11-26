import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

const MAX_STORE_BYTES = 8 * 1024 * 1024;
const runtime = globalThis as typeof globalThis & {
  tudaWriteQueues?: Map<string, Promise<unknown>>;
};

export function getDataDirectory() {
  const directory = process.env.TUDA_DATA_DIR || process.env.STATE_DIRECTORY;
  if (directory && path.isAbsolute(directory)) return directory;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production data directory must be an absolute path.");
  }
  return path.join(process.cwd(), ".data");
}

export async function readStore<T extends object>(file: string): Promise<T> {
  try {
    // User data lives outside the release bundle and is only read at runtime.
    const target = path.join(/* turbopackIgnore: true */ getDataDirectory(), file);
    const data: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ target, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid data store.");
    }
    return Object.assign(Object.create(null), data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Object.create(null) as T;
    }
    throw error;
  }
}

export async function updateStore<T extends object, Result>(
  file: string,
  update: (data: T) => Result,
): Promise<Result> {
  const directory = getDataDirectory();
  const target = path.join(/* turbopackIgnore: true */ directory, file);
  const queues = (runtime.tudaWriteQueues ??= new Map());
  const operation = (queues.get(target) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const store = await readStore<T>(file);
    const result = update(store);
    const payload = JSON.stringify(store);
    if (Buffer.byteLength(payload) > MAX_STORE_BYTES) throw new Error("Data store is full.");

    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, `.${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(payload, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
    return result;
  });

  queues.set(target, operation);
  try {
    return await operation;
  } finally {
    if (queues.get(target) === operation) queues.delete(target);
  }
}
