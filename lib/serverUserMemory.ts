import { readStore, updateStore } from "./serverData";
import {
  defaultUserMemory,
  normalizeMemoryPreferences,
  type UserMemory,
} from "./userMemory";

type UserMemoryStore = Record<string, UserMemory>;

const file = "user-memory.json";

export async function getUserMemory(userId: string) {
  const store = await readStore<UserMemoryStore>(file);
  return store[userId] ?? defaultUserMemory;
}

export async function saveUserMemory(userId: string, preferences: string[]) {
  const memory: UserMemory = {
    preferences: normalizeMemoryPreferences(preferences),
    updatedAt: new Date().toISOString(),
  };

  return updateStore<UserMemoryStore, UserMemory>(file, (store) => {
    store[userId] = memory;
    return memory;
  });
}
