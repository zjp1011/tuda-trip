import { NextResponse } from "next/server";
import { createSharedRoute } from "../../../lib/serverSharedRoutes";
import { readJson, RequestError, requestFailure, requestUser, requireSameOrigin } from "../../../lib/serverAccess";
import type { SavedTrip } from "../../../lib/savedTrips";
import { isRenderableTravelPlan } from "../../../lib/travelPlanGuardrails";
import { parseDepartureDate } from "../../../lib/weatherTool";

function isValidSavedTrip(savedTrip: unknown): savedTrip is SavedTrip {
  if (typeof savedTrip !== "object" || savedTrip === null) return false;
  const trip = savedTrip as SavedTrip;
  return [trip.id, trip.title, trip.destination]
    .every((value) => typeof value === "string" && value.trim().length > 0 && value.length <= 280)
    && parseDepartureDate(trip.departureDate) !== null
    && isRenderableTravelPlan(trip.plan);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = requestUser(request);
    const { savedTrip } = await readJson<{ savedTrip?: unknown }>(request);
    if (!isValidSavedTrip(savedTrip)) throw new RequestError(400, "行程内容无效。");
    const sharedRoute = await createSharedRoute(savedTrip, user);
    return NextResponse.json({ sharedRoute });
  } catch (error) {
    return requestFailure(error, "暂时无法创建分享链接。");
  }
}
