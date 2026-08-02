import { NextResponse } from "next/server";
import { createSharedRoute } from "../../../lib/serverSharedRoutes";
import type { SavedTrip } from "../../../lib/savedTrips";

type ShareRouteRequestBody = {
  savedTrip?: SavedTrip;
};

function isValidSavedTrip(savedTrip: unknown): savedTrip is SavedTrip {
  return (
    typeof savedTrip === "object" &&
    savedTrip !== null &&
    "id" in savedTrip &&
    "title" in savedTrip &&
    "destination" in savedTrip &&
    "plan" in savedTrip
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ShareRouteRequestBody;

    if (!isValidSavedTrip(body.savedTrip)) {
      return NextResponse.json({ error: "savedTrip is required." }, { status: 400 });
    }

    const sharedRoute = await createSharedRoute(body.savedTrip);
    return NextResponse.json({ sharedRoute });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create share route.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
