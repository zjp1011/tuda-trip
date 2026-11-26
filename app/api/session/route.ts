import { NextResponse } from "next/server";
import {
  getInviteSettings,
  limitSignIn,
  readJson,
  RequestError,
  requestFailure,
  requireSameOrigin,
  setSession,
  verifyPassword,
} from "../../../lib/serverAccess";

export async function POST(request: Request) {
  try {
    const settings = getInviteSettings();
    if (!settings) throw new RequestError(503, "内测暂未配置完成。");
    requireSameOrigin(request);
    const { password } = await readJson<{ password?: unknown }>(request, 1024);
    if (typeof password !== "string" || password.length > 128) {
      throw new RequestError(400, "请输入有效的内测口令。");
    }

    await limitSignIn(request);
    if (!verifyPassword(password, settings.password)) {
      throw new RequestError(401, "内测口令不正确。");
    }
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    return setSession(response, request);
  } catch (error) {
    return requestFailure(error, "暂时无法验证口令，请稍后再试。");
  }
}
