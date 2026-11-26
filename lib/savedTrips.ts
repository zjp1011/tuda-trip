import type { TravelPlan } from "../types/travel";

export type SavedTrip = {
  id: string;
  title: string;
  destination: string;
  departureDate?: string;
  createdAt: string;
  plan: TravelPlan;
};

export const SAVED_TRIPS_STORAGE_KEY = "tuda-saved-trips";
export const LEGACY_SAVED_TRIPS_STORAGE_KEY = "tour-ai-saved-trips";
