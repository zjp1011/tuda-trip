import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SavedTrip } from "./savedTrips";

type SavedRoutesStore = Record<string, SavedTrip[]>;

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "saved-routes.json");

async function readStore(): Promise<SavedRoutesStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as SavedRoutesStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SavedRoutesStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getSavedRoutes(userId: string) {
  const store = await readStore();
  return store[userId] ?? [];
}

export async function saveRoute(userId: string, savedTrip: SavedTrip) {
  const store = await readStore();
  const existingTrips = store[userId] ?? [];
  const planSignature = JSON.stringify(savedTrip.plan);
  const existingTrip = existingTrips.find(
    (trip) => JSON.stringify(trip.plan) === planSignature,
  );

  if (existingTrip) {
    return {
      trips: existingTrips,
      savedTrip: existingTrip,
      created: false,
    };
  }

  const nextTrips = [savedTrip, ...existingTrips];
  store[userId] = nextTrips;
  await writeStore(store);
  return {
    trips: nextTrips,
    savedTrip,
    created: true,
  };
}

export async function deleteSavedRoute(userId: string, savedTripId: string) {
  const store = await readStore();
  const nextTrips = (store[userId] ?? []).filter((trip) => trip.id !== savedTripId);
  store[userId] = nextTrips;
  await writeStore(store);
  return nextTrips;
}
