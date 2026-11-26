import { readStore, updateStore } from "./serverData";
import type { SavedTrip } from "./savedTrips";

type SavedRoutesStore = Record<string, SavedTrip[]>;

const file = "saved-routes.json";

export async function getSavedRoutes(userId: string) {
  const store = await readStore<SavedRoutesStore>(file);
  return store[userId] ?? [];
}

export async function saveRoute(userId: string, savedTrip: SavedTrip) {
  return updateStore<SavedRoutesStore, { trips: SavedTrip[]; savedTrip: SavedTrip; created: boolean }>(
    file, (store) => {
      const trips = store[userId] ?? [];
      const signature = JSON.stringify(savedTrip.plan);
      const existing = trips.find((trip) => trip.destination === savedTrip.destination
        && trip.departureDate === savedTrip.departureDate
        && JSON.stringify(trip.plan) === signature);
      if (existing) return { trips, savedTrip: existing, created: false };
      const next = [savedTrip, ...trips];
      store[userId] = next;
      return { trips: next, savedTrip, created: true };
    },
  );
}

export async function deleteSavedRoute(userId: string, savedTripId: string) {
  return updateStore<SavedRoutesStore, SavedTrip[]>(file, (store) => {
    const trips = (store[userId] ?? []).filter((trip) => trip.id !== savedTripId);
    store[userId] = trips;
    return trips;
  });
}
