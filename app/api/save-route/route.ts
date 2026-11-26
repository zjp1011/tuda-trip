import { NextResponse } from "next/server";
import { deleteSavedRoute, getSavedRoutes, saveRoute } from "../../../lib/serverSavedRoutes";
import { readJson, RequestError, requestFailure, requestUser, requireSameOrigin } from "../../../lib/serverAccess";
import type { SavedTrip } from "../../../lib/savedTrips";
import { isRenderableTravelPlan } from "../../../lib/travelPlanGuardrails";
import { parseDepartureDate } from "../../../lib/weatherTool";

type SaveRequest = { userId?: string; tripId?: string; destination?: string; departureDate?: string; plan?: unknown };
const privateHeaders = { "Cache-Control": "private, no-store" };

function guest(request: Request, developmentUserId?: unknown) {
  const user = requestUser(request, developmentUserId);
  if (!user) throw new RequestError(400, "游客身份无效。");
  return user;
}

export async function GET(request: Request) {
  try {
    const user = guest(request, new URL(request.url).searchParams.get("userId"));
    return NextResponse.json({ trips: await getSavedRoutes(user) }, { headers: privateHeaders });
  } catch (error) {
    return requestFailure(error, "暂时无法读取收藏行程。");
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<SaveRequest>(request);
    const user = guest(request, body.userId);
    if (!isRenderableTravelPlan(body.plan)) throw new RequestError(400, "行程内容无效。");
    const departureDate = parseDepartureDate(body.departureDate);
    if (departureDate === null) throw new RequestError(400, "出发日期无效。");
    const trip: SavedTrip = {
      id: crypto.randomUUID(),
      title: body.plan.plan_title,
      destination: typeof body.destination === "string" && body.destination.trim()
        ? body.destination.trim().slice(0, 100)
        : "未命名目的地",
      ...(departureDate ? { departureDate } : {}),
      createdAt: new Date().toISOString(),
      plan: body.plan,
    };
    return NextResponse.json(await saveRoute(user, trip), { headers: privateHeaders });
  } catch (error) {
    return requestFailure(error, "暂时无法收藏行程。");
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<SaveRequest>(request, 2048);
    const user = guest(request, body.userId);
    if (typeof body.tripId !== "string" || !body.tripId || body.tripId.length > 80) {
      throw new RequestError(400, "行程标识无效。");
    }
    return NextResponse.json({ trips: await deleteSavedRoute(user, body.tripId) }, { headers: privateHeaders });
  } catch (error) {
    return requestFailure(error, "暂时无法删除行程。");
  }
}
