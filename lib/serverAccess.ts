import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { updateStore } from "./serverData";

const SESSION_AGE = 90 * 24 * 60 * 60;
const GUEST_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const AUTH_FAILURE = "请先输入内测口令。";
const MAX_JSON_BYTES = 192 * 1024;
const runtime = globalThis as typeof globalThis & {
  tudaPendingPaid?: number;
  tudaPendingSignIn?: number;
};

export class RequestError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number, public code?: string) {
    super(message);
  }
}

export function requireInvite() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.TUDA_INVITE_PASSWORD);
}

export function getInviteSettings() {
  const password = process.env.TUDA_INVITE_PASSWORD;
  const secret = process.env.TUDA_SESSION_SECRET;
  const origin = process.env.TUDA_PUBLIC_ORIGIN;
  if (!password || password.length < 6 || password.length > 128 || !secret || secret.length < 32 || !origin) return null;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin !== origin || !["http:", "https:"].includes(parsedOrigin.protocol)) return null;
    if (parsedOrigin.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
  } catch {
    return null;
  }
  return { password, secret, origin };
}

export function getCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-tuda-session" : "tuda-session";
}

function sign(payload: string, settings: NonNullable<ReturnType<typeof getInviteSettings>>) {
  return createHmac("sha256", settings.secret)
    .update(settings.password).update("\0").update(payload).digest();
}

export function sessionUser(cookie: string | undefined) {
  const settings = getInviteSettings();
  if (!settings || !cookie || cookie.length > 128) return null;
  const [id, expires, signature, extra] = cookie.split(".");
  if (extra || !GUEST_ID.test(id) || !/^\d{10}$/.test(expires) || !/^[0-9a-f]{64}$/.test(signature)) {
    return null;
  }
  if (Number(expires) <= Date.now() / 1000) return null;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), sign(`${id}.${expires}`, settings))) return null;
  return id;
}

export function requireSameOrigin(request: Request) {
  const expectedOrigin = getInviteSettings()?.origin ?? new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!requireInvite() && !origin) return;
  if (origin !== expectedOrigin) throw new RequestError(403, "请求来源未经授权。");
}

function readSessionCookie(request: Request) {
  const prefix = `${getCookieName()}=`;
  return request.headers.get("cookie")?.split(";").map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
}

export function requestUser(request: Request, developmentUserId?: unknown) {
  if (!requireInvite()) {
    return typeof developmentUserId === "string" && GUEST_ID.test(developmentUserId)
      ? developmentUserId
      : null;
  }
  if (!getInviteSettings()) throw new RequestError(503, "内测暂未配置完成。");
  const user = sessionUser(readSessionCookie(request));
  if (!user) throw new RequestError(401, AUTH_FAILURE);
  return user;
}

export function verifyPassword(input: string, password: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(input), digest(password));
}

export function setSession(response: NextResponse, request: Request) {
  const settings = getInviteSettings();
  if (!settings) throw new RequestError(503, "内测暂未配置完成。");
  const user = sessionUser(readSessionCookie(request)) ?? randomUUID();
  const payload = `${user}.${Math.floor(Date.now() / 1000) + SESSION_AGE}`;
  response.cookies.set(getCookieName(), `${payload}.${sign(payload, settings).toString("hex")}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_AGE,
  });
  return response;
}

type QuotaWindow = { window: number; count: number };
type LoginQuota = { global?: QuotaWindow; peers?: Record<string, number> };

export async function limitSignIn(request: Request) {
  const client = request.headers.get("x-tuda-client-ip") ?? "";
  const settings = getInviteSettings();
  const source = settings && process.env.TUDA_TRUST_PROXY === "1" && isIP(client)
    ? createHmac("sha256", settings.secret).update(client).digest("hex")
    : "unknown";
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  if ((runtime.tudaPendingSignIn ?? 0) >= 8) {
    throw new RequestError(429, "入口正在忙，请稍后再试。", 10);
  }
  runtime.tudaPendingSignIn = (runtime.tudaPendingSignIn ?? 0) + 1;

  try {
    await updateStore<LoginQuota, void>("login-usage.json", (store) => {
      if (store.global?.window !== window || !store.peers) {
        store.global = { window, count: 0 };
        store.peers = {};
      }
      const count = store.peers[source] ?? 0;
      if (count >= 8 || store.global.count >= 80) {
        throw new RequestError(429, "尝试次数太多，请稍后再试。", 900);
      }
      store.global.count++;
      store.peers[source] = count + 1;
    });
  } finally {
    runtime.tudaPendingSignIn--;
  }
}

type PaidQuota = {
  global?: QuotaWindow;
  users?: Record<string, { minute: number; minuteCount: number; dayCount: number }>;
};

export async function claimPaidRequest(user: string | null) {
  if ((runtime.tudaPendingPaid ?? 0) >= 2) {
    throw new RequestError(429, "生成服务正在忙，请稍后再试。", 10);
  }
  runtime.tudaPendingPaid = (runtime.tudaPendingPaid ?? 0) + 1;
  const release = () => { runtime.tudaPendingPaid = (runtime.tudaPendingPaid ?? 1) - 1; };

  try {
    const now = Date.now();
    const day = Math.floor(now / 86_400_000);
    const minute = Math.floor(now / 60_000);
    const limit = Number(process.env.TUDA_DAILY_CALL_LIMIT ?? 120);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new RequestError(503, "生成额度暂未配置完成。");
    }

    await updateStore<PaidQuota, void>("paid-usage.json", (store) => {
      if (store.global?.window !== day || !store.users) {
        store.global = { window: day, count: 0 };
        store.users = {};
      }
      const key = user ?? "development";
      const quota = store.users[key] ?? { minute, minuteCount: 0, dayCount: 0 };
      if (quota.minute !== minute) {
        quota.minute = minute;
        quota.minuteCount = 0;
      }
      if (store.global.count >= limit || quota.dayCount >= 30) {
        throw new RequestError(429, "今日生成额度已用完，请明天再试。", 86_400);
      }
      if (quota.minuteCount >= 4) throw new RequestError(429, "生成太频繁，请稍后再试。", 60);

      store.global.count++;
      quota.dayCount++;
      quota.minuteCount++;
      store.users[key] = quota;
    });
  } catch (error) {
    release();
    throw error;
  }
  return release;
}

export async function readJson<T>(request: Request, limit = MAX_JSON_BYTES): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" || !request.body) {
    throw new RequestError(400, "请求必须使用 JSON。");
  }
  if (Number(request.headers.get("content-length")) > limit) {
    throw new RequestError(413, "提交的数据过大。");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestError(413, "提交的数据过大。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
    if (body && typeof body === "object" && !Array.isArray(body)) return body as T;
  } catch {}
  throw new RequestError(400, "请求格式无效。");
}

export function requestFailure(error: unknown, fallback: string) {
  if (error instanceof RequestError) {
    const headers = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined;
    const data = { error: error.message, ...(error.code ? { code: error.code } : {}) };
    return NextResponse.json(data, { status: error.status, headers });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function readDeepSeekKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new RequestError(400, "请先填写自己的 DeepSeek API Key。", undefined, "deepseek_key_required");
  }
  const key = /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/i.exec(authorization)?.[1];
  if (!key || key.length > 512) {
    throw new RequestError(401, "DeepSeek API Key 格式有误，请重新填写。", undefined, "deepseek_key_invalid");
  }
  return key;
}

export function deepSeekCacheScope(user: string | null, apiKey: string) {
  const settings = getInviteSettings();
  if (!user || !settings) return null;
  return createHmac("sha256", settings.secret)
    .update("tuda-byok-cache-v1\0").update(user).update("\0").update(apiKey)
    .digest("hex").slice(0, 32);
}

type DeepSeekMessage = { role: "system" | "user"; content: string };

export async function callDeepSeek(
  apiKey: string,
  messages: DeepSeekMessage[],
  options: { timeout: number; maxTokens: number; json?: boolean },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(options.timeout),
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        messages,
        thinking: { type: "disabled" },
        max_tokens: options.maxTokens,
        stream: false,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch {
    throw new RequestError(502, "无法连接 DeepSeek，请稍后再试。");
  }
  if (response.ok) {
    return response.json().catch(() => {
      throw new RequestError(502, "DeepSeek 返回的数据无效，请稍后再试。");
    });
  }

  void response.body?.cancel().catch(() => {});
  if (response.status === 401 || response.status === 403) {
    throw new RequestError(401, "DeepSeek API Key 无效或权限不足，请检查后重试。", undefined, "deepseek_key_invalid");
  }
  if (response.status === 402) {
    throw new RequestError(402, "DeepSeek 账户余额不足，请检查账户后重试。", undefined, "deepseek_balance_required");
  }
  if (response.status === 429) {
    throw new RequestError(429, "DeepSeek 暂时限制了调用频率，请稍后再试。", 60, "deepseek_rate_limited");
  }
  throw new RequestError(502, "DeepSeek 暂不可用，请稍后再试。");
}
