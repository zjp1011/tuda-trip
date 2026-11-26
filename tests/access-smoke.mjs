import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4192");
assert.equal(base.hostname, "127.0.0.1", "Run against an isolated loopback test instance.");
const origin = process.env.TUDA_PUBLIC_ORIGIN;
const password = process.env.TUDA_INVITE_PASSWORD;
assert.ok(origin && password, "Configure the isolated test instance before running the test.");

function request(path, { method = "GET", body, cookie, authorization, requestOrigin = origin } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;
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
assert.equal((await health.json()).generationMode, "byok");
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

const payload = { destination: "成都", days: 1, companion: "朋友" };
const forecastDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const departureDate = forecastDate(1);
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
const paidRequests = [
  ["/api/generate", payload],
  ["/api/refine-route", { currentPlan: plan, instruction: "根据体检结果，帮我优化这份路线", destination: "成都" }],
  ["/api/generate-copy", { tripSummary: "成都散步", platform: "moments" }],
];
for (const [endpoint, body] of paidRequests) {
  const missing = await request(endpoint, { method: "POST", body, cookie: first });
  assert.equal(missing.status, 400, endpoint);
  assert.equal((await missing.json()).code, "deepseek_key_required");
  const malformed = await request(endpoint, {
    method: "POST", body, cookie: first, authorization: "Bearer malformed key",
  });
  assert.equal(malformed.status, 401, endpoint);
  assert.equal((await malformed.json()).code, "deepseek_key_invalid");
}
assert.equal((await request("/api/generate", {
  method: "POST", body: { ...payload, destination: "a".repeat(16_384) }, cookie: first,
  authorization: "Bearer sk-synthetic-overflow-check",
})).status, 413);

if (process.env.TUDA_SMOKE_MOCK_UPSTREAMS === "1") {
  const invoke = (endpoint, body, key, cookie = first) =>
    request(endpoint, { method: "POST", body, cookie, authorization: `Bearer ${key}` });
  for (const [endpoint, body] of paidRequests) {
    const response = await invoke(endpoint, body, "sk-byok-test-good");
    assert.equal(response.status, 200, endpoint);
    const result = await response.json();
    assert.match(JSON.stringify(result), /BYOK 模拟/);
    if (endpoint === "/api/refine-route") {
      assert.equal(result.actions.find((action) => action.toolName === "weather_tool")?.status, "skipped");
    }
  }
  const rejected = await invoke("/api/generate-copy", paidRequests[2][1], "sk-byok-test-bad");
  assert.equal(rejected.status, 401);
  const rejectedBody = await rejected.json();
  assert.equal(rejectedBody.code, "deepseek_key_invalid");
  assert.doesNotMatch(rejectedBody.error, /sk-byok-test|untrusted upstream/);
  const fare = await invoke("/api/generate-copy", paidRequests[2][1], "sk-byok-test-no-balance", second);
  assert.equal(fare.status, 402);
  assert.equal((await fare.json()).code, "deepseek_balance_required");

  const incomplete = await invoke("/api/generate", { ...payload, days: 3 }, "sk-byok-test-good", second);
  assert.equal(incomplete.status, 502, "A one-day model reply cannot satisfy a three-day request.");
  const invalidDate = await invoke("/api/generate", { ...payload, departureDate: "2026-02-30" }, "sk-byok-test-good", second);
  assert.equal(invalidDate.status, 400);
  const undated = await request("/api/weather?destination=成都&days=2", { cookie: second });
  assert.equal(undated.status, 200);
  assert.equal((await undated.json()).weather, null);
  const forecast = await request("/api/weather?destination=成都&days=2&departureDate=" + departureDate, { cookie: second });
  assert.equal(forecast.status, 200);
  assert.deepEqual((await forecast.json()).weather.days.map((day) => day.date), [departureDate, forecastDate(2)]);
}

const saved = await request("/api/save-route", {
  method: "POST", body: { userId: submittedId, destination: "成都", departureDate, plan }, cookie: first,
});
assert.equal(saved.status, 200);
assert.equal((await saved.json()).savedTrip.departureDate, departureDate);

const share = await request("/api/share-route", {
  method: "POST",
  body: { savedTrip: { id: randomUUID(), title: "内测样例行程", destination: "成都", departureDate, plan } },
  cookie: first,
});
assert.equal(share.status, 200);
const { sharedRoute } = await share.json();
assert.equal(sharedRoute.departureDate, departureDate);
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
console.log("内测登录、自带 Key、会话隔离、行程天数校验、预报日期、收藏及公开分享验证通过。");
