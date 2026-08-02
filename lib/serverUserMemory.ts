import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  defaultUserMemory,
  normalizeMemoryPreferences,
  type UserMemory,
} from "./userMemory";

type UserMemoryStore = Record<string, UserMemory>;

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "user-memory.json");

async function readStore(): Promise<UserMemoryStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as UserMemoryStore;
  } catch {
    return {};
  }
}

async function writeStore(store: UserMemoryStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getUserMemory(userId: string) {
  const store = await readStore();
  return store[userId] ?? defaultUserMemory;
}

export async function saveUserMemory(userId: string, preferences: string[]) {
  const store = await readStore();
  const memory: UserMemory = {
    preferences: normalizeMemoryPreferences(preferences),
    updatedAt: new Date().toISOString(),
  };

  store[userId] = memory;
  await writeStore(store);
  return memory;
}
