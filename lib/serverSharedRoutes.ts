import { mkdir, readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import type { SavedTrip } from "./savedTrips";

export type SharedRoute = {
  id: string;
  sourceTripId: string;
  title: string;
  destination: string;
  createdAt: string;
  plan: SavedTrip["plan"];
};

type SharedRoutesStore = Record<string, SharedRoute>;

const dataDirectory = path.join(process.cwd(), ".data");
const storePath = path.join(dataDirectory, "shared-routes.json");

async function readStore(): Promise<SharedRoutesStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as SharedRoutesStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SharedRoutesStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function createSharedRoute(savedTrip: SavedTrip) {
  const store = await readStore();
  const existingShare = Object.values(store).find(
    (share) => share.sourceTripId === savedTrip.id,
  );

  if (existingShare) {
    return existingShare;
  }

  let shareId = randomUUID().slice(0, 8);

  while (store[shareId]) {
    shareId = randomUUID().slice(0, 8);
  }

  const sharedRoute: SharedRoute = {
    id: shareId,
    sourceTripId: savedTrip.id,
    title: savedTrip.title,
    destination: savedTrip.destination,
    createdAt: new Date().toISOString(),
    plan: savedTrip.plan,
  };

  store[sharedRoute.id] = sharedRoute;
  await writeStore(store);
  return sharedRoute;
}

export async function getSharedRoute(shareId: string) {
  const store = await readStore();
  return store[shareId] ?? null;
}
