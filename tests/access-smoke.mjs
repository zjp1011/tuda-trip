import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4192");
assert.equal(base.hostname, "127.0.0.1", "Run against an isolated loopback test instance.");
const origin = process.env.TUDA_PUBLIC_ORIGIN;
const password = process.env.TUDA_INVITE_PASSWORD;
assert.ok(origin && password, "Configure the isolated test instance before running the test.");

function request(path, { method = "GET", body, cookie, requestOrigin = origin } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) {
    headers.Origin = requestOrigin;
    headers["Content-Type"] = "application/json";
  }
  return fetch(new URL(path, base), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function signIn() {
  const response = await request("/api/session", { method: "POST", body: { password } });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.startsWith("__Host-tuda-session="));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=Strict/i);
  return cookie.split(";")[0];
}

const health = await request("/api/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).generationConfigured, false, "The smoke instance must omit a live model key.");
assert.match(await (await request("/")).text(), /途搭内测/);
assert.equal((await request("/api/save-route?userId=" + randomUUID())).status, 401);
assert.equal((await request("/api/generate", { method: "POST", body: {} })).status, 401);
assert.equal((await request("/api/session", {
  method: "POST",
  body: { password },
  requestOrigin: "https://unrelated.example",
})).status, 403);

const [first, second] = await Promise.all([signIn(), signIn()]);
assert.notEqual(first, second);
assert.equal((await request("/api/save-route", {
  cookie: first.slice(0, -1) + (first.at(-1) === "f" ? "e" : "f"),
})).status, 401);

const submittedId = randomUUID();
const updates = await Promise.all([first, second].map((cookie, index) => request("/api/user-memory", {
  method: "PUT",
  body: { userId: submittedId, preferences: ["偏好 " + index] },
  cookie,
})));
assert.equal(updates[0].status, 200);
assert.equal(updates[1].status, 200);
for (const [index, cookie] of [first, second].entries()) {
  const response = await request("/api/user-memory?userId=" + submittedId, { cookie });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).memory.preferences, ["偏好 " + index]);
}

const payload = { destination: "成都", days: 3, companion: "朋友" };
assert.equal((await request("/api/generate", { method: "POST", body: payload, cookie: first })).status, 503);
assert.equal((await request("/api/generate", {
  method: "POST", body: { ...payload, destination: "a".repeat(16_384) }, cookie: first,
})).status, 413);

const plan = {
  plan_id: "example",
  plan_title: "内测样例行程",
  highlights: ["散步"],
  budget_per_person: "100 元",
  pace_rating: 3,
  days: [{
    day_number: 1,
    day_theme: "慢游",
    schedule: [{ time_bucket: "上午", type: "spot", location: "公园", activity: "散步", duration: "1 小时", tips: "带水" }],
    accommodation: { area_recommendation: "市区", reason: "交通方便" },
  }],
};
const share = await request("/api/share-route", {
  method: "POST",
  body: { savedTrip: { id: randomUUID(), title: "内测样例行程", destination: "成都", plan } },
  cookie: first,
});
assert.equal(share.status, 200);
const { sharedRoute } = await share.json();
const publicPage = await request("/share/" + sharedRoute.id);
assert.equal(publicPage.status, 200);
assert.match(await publicPage.text(), /内测样例行程/);

const loginStatuses = new Set();
for (let attempt = 0; attempt < 17; attempt++) {
  const response = await request("/api/session", { method: "POST", body: { password: "wrong-test-password" } });
  loginStatuses.add(response.status);
  if (response.status === 429) break;
}
assert.ok(loginStatuses.has(401));
assert.ok(loginStatuses.has(429));
console.log("内测入口、登录限流、同源校验、会话隔离、请求上限和公开分享验证通过。");
