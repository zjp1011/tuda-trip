import { NextResponse } from "next/server";
import {
  deleteSavedRoute,
  getSavedRoutes,
  saveRoute,
} from "../../../lib/serverSavedRoutes";
import type { SavedTrip } from "../../../lib/savedTrips";
import type { TravelPlan } from "../../../types/travel";

type SaveRouteRequestBody = {
  userId?: string;
  tripId?: string;
  destination?: string;
  plan?: TravelPlan;
};

function isValidPlan(plan: unknown): plan is TravelPlan {
  return (
    typeof plan === "object" &&
    plan !== null &&
    "plan_id" in plan &&
    "plan_title" in plan &&
    "days" in plan
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const trips = await getSavedRoutes(userId);
  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveRouteRequestBody;

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!isValidPlan(body.plan)) {
      return NextResponse.json({ error: "plan is required." }, { status: 400 });
    }

    const savedTrip: SavedTrip = {
      id: crypto.randomUUID(),
      title: body.plan.plan_title,
      destination: body.destination || "未命名目的地",
      createdAt: new Date().toISOString(),
      plan: body.plan,
    };

    const trips = await saveRoute(body.userId, savedTrip);
    return NextResponse.json({ trips, savedTrip });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save route.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as SaveRouteRequestBody;

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (!body.tripId) {
      return NextResponse.json({ error: "tripId is required." }, { status: 400 });
    }

    const trips = await deleteSavedRoute(body.userId, body.tripId);
    return NextResponse.json({ trips });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete route.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
