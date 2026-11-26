import { randomUUID } from "crypto";
import { readStore, updateStore } from "./serverData";
import type { SavedTrip } from "./savedTrips";
import { parseDepartureDate } from "./weatherTool";

export type SharedRoute = {
  id: string;
  sourceTripId: string;
  title: string;
  destination: string;
  departureDate?: string;
  createdAt: string;
  plan: SavedTrip["plan"];
};

type ShareEntry = SharedRoute & { ownerId?: string };
type SharedRoutesStore = Record<string, ShareEntry>;
const file = "shared-routes.json";
const shareIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}(?:-[0-9a-f]{4}){2}-[0-9a-f]{12})?$/i;

export async function createSharedRoute(savedTrip: SavedTrip, userId: string | null) {
  return updateStore<SharedRoutesStore, SharedRoute>(file, (store) => {
    const existingShare = Object.values(store).find(
      (share) => share.sourceTripId === savedTrip.id && share.ownerId === (userId ?? undefined),
    );
    if (existingShare) return existingShare;

    const departureDate = parseDepartureDate(savedTrip.departureDate);
    const sharedRoute: SharedRoute = {
      id: randomUUID(),
      sourceTripId: savedTrip.id,
      title: savedTrip.title,
      destination: savedTrip.destination,
      ...(departureDate ? { departureDate } : {}),
      createdAt: new Date().toISOString(),
      plan: savedTrip.plan,
    };
    store[sharedRoute.id] = { ...sharedRoute, ownerId: userId ?? undefined };
    return sharedRoute;
  });
}

export async function getSharedRoute(shareId: string) {
  if (!shareIdPattern.test(shareId)) return null;
  const store = await readStore<SharedRoutesStore>(file);
  return store[shareId] ?? null;
}
