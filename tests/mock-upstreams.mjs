import assert from "node:assert/strict";

assert.equal(process.env.TUDA_SMOKE_MOCK_UPSTREAMS, "1", "Only enable this module for an isolated smoke test.");

const realFetch = globalThis.fetch;
const modelURL = "https://api.deepseek.com/chat/completions";
const testPlan = {
  plan_id: "example",
  plan_title: "BYOK 模拟行程",
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

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return realFetch(input, init);

  if (url.origin === "https://geocoding-api.open-meteo.com") {
    assert.equal(headers.get("authorization"), null, "The browser's DeepSeek Key must never reach weather services.");
    return Response.json({ results: [] });
  }

  assert.equal(url.href, modelURL, "Smoke tests must never call a real external endpoint.");
  assert.equal(init?.method, "POST");
  const key = headers.get("authorization");
  if (key === "Bearer sk-byok-test-bad") {
    return Response.json({ error: { message: "untrusted upstream error sk-byok-test-bad" } }, { status: 401 });
  }
  if (key === "Bearer sk-byok-test-no-balance") return Response.json({}, { status: 402 });
  assert.equal(key, "Bearer sk-byok-test-good", "Only the user-supplied synthetic key may be relayed.");

  const request = JSON.parse(init.body);
  const refine = request.messages.some(({ content }) => content.includes("当前行程 JSON"));
  const content = refine ? JSON.stringify({ reply: "BYOK 模拟修改", plan: testPlan })
    : request.response_format ? JSON.stringify({ plans: [testPlan] })
    : "BYOK 模拟分享文案";
  return Response.json({ choices: [{ message: { content } }] });
};
