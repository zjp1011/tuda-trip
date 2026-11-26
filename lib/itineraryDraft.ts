import type { TravelPlan } from "../types/travel";
import { isRenderableTravelPlan } from "./travelPlanGuardrails";

const storageKey = "tuda-itinerary-draft";
const companions = ["单人", "情侣", "亲子", "朋友"] as const;
const budgets = ["经济实惠", "舒适预算", "品质享受", "不设上限"] as const;

export type ItineraryContext = {
  destination: string;
  days: number;
  departureDate: string;
};

export type ItinerarySnapshot = { context: ItineraryContext; plan: TravelPlan };

export type ItineraryDraft = {
  form: {
    destination: string;
    days: string;
    departureDate: string;
    companion: (typeof companions)[number];
    budgetPreference: (typeof budgets)[number];
    customBudget: string;
    travelStyles: string[];
    foodPreferences: string[];
    customFoodPreference: string;
  };
  current: ItinerarySnapshot | null;
  previous: ItinerarySnapshot | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function limitText(value: unknown, length: number) {
  return typeof value === "string" ? value.slice(0, length) : "";
}

function limitList(value: unknown, count: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, count).map((item) => limitText(item, 80)).filter(Boolean);
}

function departureDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function readForm(form: Record<string, unknown>): ItineraryDraft["form"] {
  return {
    destination: limitText(form.destination, 100),
    days: typeof form.days === "string" && /^[1-7]$/.test(form.days) ? form.days : "3",
    departureDate: departureDate(form.departureDate),
    companion: companions.find((option) => option === form.companion) ?? "朋友",
    budgetPreference: budgets.find((option) => option === form.budgetPreference) ?? "舒适预算",
    customBudget: limitText(form.customBudget, 12).replace(/[^\d]/g, ""),
    travelStyles: limitList(form.travelStyles, 3),
    foodPreferences: limitList(form.foodPreferences, 6),
    customFoodPreference: limitText(form.customFoodPreference, 120),
  };
}

function readSnapshot(value: unknown): ItinerarySnapshot | null {
  if (!isRecord(value) || !isRecord(value.context) || !isRenderableTravelPlan(value.plan)) return null;
  const { context, plan } = value;
  const destination = limitText(context.destination, 100).trim();
  if (!destination || context.days !== plan.days.length) return null;

  // Model JSON can contain extra properties. Store only the fields the itinerary renders.
  const { plan_id, plan_title, highlights, budget_per_person, pace_rating, days } = plan;
  return {
    context: { destination, days: days.length, departureDate: departureDate(context.departureDate) },
    plan: {
      plan_id, plan_title, highlights, budget_per_person, pace_rating,
      days: days.map(({ day_number, day_theme, accommodation, schedule }) => ({
        day_number,
        day_theme,
        accommodation: {
          area_recommendation: accommodation.area_recommendation,
          reason: accommodation.reason,
        },
        schedule: schedule.map(({ time_bucket, type, location, activity, duration, tips }) => ({
          time_bucket, type, location, activity, duration, tips,
        })),
      })),
    },
  };
}

function readDraft(value: unknown): ItineraryDraft | null {
  if (!isRecord(value) || !isRecord(value.form)) return null;
  const current = readSnapshot(value.current);
  return {
    form: readForm(value.form),
    current,
    previous: current ? readSnapshot(value.previous) : null,
  };
}

export function readItineraryDraft(): ItineraryDraft | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    return isRecord(value) && value.version === 1 ? readDraft(value) : null;
  } catch {
    return null;
  }
}

export function writeItineraryDraft(draft: ItineraryDraft): boolean {
  try {
    const normalized = readDraft(draft);
    if (!normalized) return false;
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...normalized }));
    return true;
  } catch {
    return false;
  }
}
