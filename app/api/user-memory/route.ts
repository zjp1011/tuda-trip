import { NextResponse } from "next/server";
import { getUserMemory, saveUserMemory } from "../../../lib/serverUserMemory";
import { readJson, RequestError, requestFailure, requestUser, requireSameOrigin } from "../../../lib/serverAccess";
import { normalizeMemoryPreferences } from "../../../lib/userMemory";

type MemoryRequest = { userId?: string; preferences?: string[] };
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const user = requestUser(request, new URL(request.url).searchParams.get("userId"));
    if (!user) throw new RequestError(400, "游客身份无效。");
    return NextResponse.json({ memory: await getUserMemory(user) }, { headers: privateHeaders });
  } catch (error) {
    return requestFailure(error, "暂时无法读取旅行偏好。");
  }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<MemoryRequest>(request, 16 * 1024);
    const user = requestUser(request, body.userId);
    if (!user) throw new RequestError(400, "游客身份无效。");
    const memory = await saveUserMemory(user, normalizeMemoryPreferences(body.preferences));
    return NextResponse.json({ memory }, { headers: privateHeaders });
  } catch (error) {
    return requestFailure(error, "暂时无法保存旅行偏好。");
  }
}
