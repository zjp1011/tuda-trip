import { NextResponse } from "next/server";
import { claimPaidRequest, getDeepSeekKey, readJson, RequestError, requestFailure, requestUser, requireSameOrigin } from "../../../lib/serverAccess";
import { isRenderableTravelPlan } from "../../../lib/travelPlanGuardrails";
import { generateEmbedding } from "../../../lib/openai";
import { formatUserMemoryForPrompt, normalizeMemoryPreferences } from "../../../lib/userMemory";
import {
  formatWeatherForPrompt,
  getDestinationWeather,
  type DestinationWeather,
} from "../../../lib/weatherTool";
import type { TravelPlansResponse } from "../../../types/travel";

type GenerateRequestBody = {
  destination?: string;
  days?: number;
  companion?: string;
  budgetPreference?: string;
  customBudget?: string;
  travelStyles?: string[];
  foodPreferences?: string[];
  customFoodPreference?: string;
  userMemoryPreferences?: string[];
};

type NormalizedGenerateRequest = {
  destination: string;
  days: number;
  companion: string;
  budgetPreference: string;
  customBudget: string;
  travelStyles: string[];
  foodPreferences: string[];
  customFoodPreference: string;
  userMemoryPreferences: string[];
};

type TravelCacheMetadata = {
  travelPlanJson?: string;
  cacheKeyText?: string;
  createdAt?: string;
};

const CACHE_HIT_THRESHOLD = 0.95;
const UPSTASH_TIMEOUT_MS = 2500;

function normalizeRequestBody(body: GenerateRequestBody): NormalizedGenerateRequest | null {
  const trim = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const normalizeChoices = (value: unknown, limit: number) => Array.isArray(value)
    ? value.slice(0, limit).map((item: unknown) => trim(item, 80)).filter(Boolean)
    : [];
  const destination = trim(body.destination, 100);
  const days = Number(body.days);
  const companion = trim(body.companion, 30);
  const budgetPreference = trim(body.budgetPreference, 80) || "舒适预算";
  const customBudget = trim(body.customBudget, 12).replace(/[^\d]/g, "");
  const travelStyles = normalizeChoices(body.travelStyles, 3);
  const foodPreferences = normalizeChoices(body.foodPreferences, 10);
  const customFoodPreference = trim(body.customFoodPreference, 120);
  const userMemoryPreferences = normalizeMemoryPreferences(body.userMemoryPreferences);

  if (!destination || !Number.isInteger(days) || days < 1 || days > 7 || !companion) {
    return null;
  }

  return {
    destination,
    days,
    companion,
    budgetPreference,
    customBudget,
    travelStyles,
    foodPreferences,
    customFoodPreference,
    userMemoryPreferences,
  };
}

function buildCacheKeyText(body: NormalizedGenerateRequest, weather: DestinationWeather | null) {
  return [
    body.destination,
    `${body.days}天`,
    body.companion,
    body.budgetPreference,
    body.customBudget ? `自定义人均${body.customBudget}元` : "",
    ...body.travelStyles,
    ...body.foodPreferences,
    body.customFoodPreference,
    ...body.userMemoryPreferences,
    weather ? new Date().toISOString().slice(0, 10) : "",
    weather?.summary ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUserPrompt(body: NormalizedGenerateRequest, weather: DestinationWeather | null) {
  const budgetText = body.customBudget
    ? `自定义人均 ${body.customBudget} 元`
    : body.budgetPreference;

  return `
请根据以下用户偏好，生成 1 个适合展示在 Web App 中的旅游行程 JSON。

- 目的地：${body.destination}
- 游玩天数：${body.days} 天
- 同行人员：${body.companion}
- 人均预算：${budgetText}
- 旅游风格：${body.travelStyles.length > 0 ? body.travelStyles.join("、") : "未指定"}
- 必吃美食类别：${body.foodPreferences.length > 0 ? body.foodPreferences.join("、") : "未指定"}
- 自定义饮食偏好：${body.customFoodPreference || "未指定"}
- 长期偏好记忆：${formatUserMemoryForPrompt(body.userMemoryPreferences)}

天气工具结果：
${formatWeatherForPrompt(weather)}

要求：
1. 只返回 JSON，不要输出 Markdown、解释、代码块或额外文字。
2. plans 数组中返回 1 个方案。
3. pace_rating 是 1-5 的数字，1 最紧凑，5 最松弛。
4. days 数组长度必须等于用户选择的游玩天数。
5. 每天 schedule 建议包含 3-5 个安排。
6. time_bucket 只能使用：上午、中午、下午、晚餐、晚上。
7. type 只能使用：spot、food、transit、rest。
8. 内容要实用、具体、有本地感，避免空泛描述。
9. 如果用户选择了美食与饮食偏好，必须把这些偏好融入路线，每天至少安排 1 个 type 为 food 的日程。
10. food 类型的 location 要尽量给出具体街区、店名或美食聚集地，activity 和 tips 里要写清推荐吃什么。
11. 如果用户填写了忌口、口味或饮食限制，tips 里要体现规避建议或替代选择。
12. 必须严格参考人均预算安排餐饮、交通、住宿区域和活动，不要推荐明显超出预算的路线。
13. 如果用户填写了自定义金额，必须优先按照自定义金额控制预算，而不是预算档位。
14. budget_per_person 必须输出与用户预算匹配的预估区间，例如自定义人均 800 元时可输出 700-900元。
15. 必须参考长期偏好记忆。如果长期记忆和本次表单冲突，以本次表单为准，并在 tips 中给出规避或替代建议。
16. 必须参考天气工具结果。如果有降雨、高温或低温风险，要调整户外/室内节奏，并在 tips 中给出雨天、防晒或保暖建议。

JSON 输出格式示例：
{
  "plans": [
    {
      "plan_id": "plan_1",
      "plan_title": "松弛探店版·成都3天2晚",
      "highlights": ["行程亮点1", "行程亮点2"],
      "budget_per_person": "1200-1500元",
      "pace_rating": 4,
      "days": [
        {
          "day_number": 1,
          "day_theme": "当日主题",
          "schedule": [
            {
              "time_bucket": "上午",
              "type": "spot",
              "location": "具体地点",
              "activity": "具体活动描述",
              "duration": "2小时",
              "tips": "实用小贴士"
            }
          ],
          "accommodation": {
            "area_recommendation": "建议入住区域",
            "reason": "推荐理由"
          }
        }
      ]
    }
  ]
}
`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function parseCachedTravelPlan(metadata: TravelCacheMetadata | undefined) {
  if (!metadata?.travelPlanJson) {
    return null;
  }

  try {
    return JSON.parse(metadata.travelPlanJson) as TravelPlansResponse;
  } catch (error) {
    console.warn("Cached travel plan JSON parse failed:", error);
    return null;
  }
}

async function queryTravelPlanCache(embedding: number[]) {
  try {
    const { vectorIndex } = await import("../../../lib/upstash");
    const results = await withTimeout(
      vectorIndex.query<TravelCacheMetadata>({
        vector: embedding,
        topK: 1,
        includeMetadata: true,
      }),
      UPSTASH_TIMEOUT_MS,
      "Upstash query",
    );

    const bestMatch = results[0];

    if (!bestMatch || bestMatch.score <= CACHE_HIT_THRESHOLD) {
      return null;
    }

    const cachedTravelPlan = parseCachedTravelPlan(bestMatch.metadata);

    if (!cachedTravelPlan) {
      return null;
    }

    console.log("⚡ 缓存命中");
    return cachedTravelPlan;
  } catch {
    console.warn("Upstash cache unavailable, continuing with generation.");
    return null;
  }
}

async function generateTravelPlanWithLLM(
  body: NormalizedGenerateRequest,
  weather: DestinationWeather | null,
  apiKey: string,
) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(75_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
      messages: [
        {
          role: "system",
          content: "你是一个资深旅行规划师。你必须输出能被 JSON.parse 解析的 JSON。",
        },
        {
          role: "user",
          content: buildUserPrompt(body, weather),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 4000,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new RequestError(502, "AI 生成服务暂不可用。");
  }

  const completion = await response.json();
  const outputText =
    typeof completion === "object" &&
    completion !== null &&
    "choices" in completion &&
    Array.isArray(completion.choices) &&
    typeof completion.choices[0]?.message?.content === "string"
      ? completion.choices[0].message.content
      : "";

  if (!outputText) {
    throw new Error("DeepSeek returned an empty travel plan response.");
  }

  const parsed = JSON.parse(outputText) as TravelPlansResponse;
  if (!Array.isArray(parsed?.plans) || parsed.plans.length === 0 ||
      !parsed.plans.every(isRenderableTravelPlan)) {
    throw new RequestError(502, "AI 返回的行程不完整，请重试。");
  }
  return parsed;
}

async function upsertTravelPlanCache(
  embedding: number[],
  cacheKeyText: string,
  travelPlan: TravelPlansResponse,
) {
  try {
    const { vectorIndex } = await import("../../../lib/upstash");
    await withTimeout(
      vectorIndex.upsert<TravelCacheMetadata>({
        id: crypto.randomUUID(),
        vector: embedding,
        metadata: {
          travelPlanJson: JSON.stringify(travelPlan),
          cacheKeyText,
          createdAt: new Date().toISOString(),
        },
      }),
      UPSTASH_TIMEOUT_MS,
      "Upstash upsert",
    );
  } catch {
    console.warn("Upstash cache write failed.");
  }
}

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const user = requestUser(request);
    requireSameOrigin(request);
    const body = await readJson<GenerateRequestBody>(request, 16 * 1024);
    const normalizedBody = normalizeRequestBody(body);

    if (!normalizedBody) {
      return NextResponse.json(
        { error: "Invalid request. destination, days(1-7), and companion are required." },
        { status: 400 },
      );
    }

    const apiKey = getDeepSeekKey();
    release = await claimPaidRequest(user);
    let weather: DestinationWeather | null = null;

    try {
      weather = await getDestinationWeather(normalizedBody.destination, normalizedBody.days);
    } catch {
      console.warn("Weather service unavailable, continuing without forecast.");
    }

    if (process.env.UPSTASH_VECTOR_REST_URL && process.env.UPSTASH_VECTOR_REST_TOKEN) {
      const cacheKeyText = buildCacheKeyText(normalizedBody, weather);
      const embedding = await generateEmbedding(cacheKeyText);
      const cachedTravelPlan = await queryTravelPlanCache(embedding);
      if (cachedTravelPlan) return NextResponse.json(cachedTravelPlan);
      const travelPlan = await generateTravelPlanWithLLM(normalizedBody, weather, apiKey);
      await upsertTravelPlanCache(embedding, cacheKeyText, travelPlan);
      return NextResponse.json(travelPlan);
    }
    return NextResponse.json(await generateTravelPlanWithLLM(normalizedBody, weather, apiKey));
  } catch (error) {
    return requestFailure(error, "暂时无法生成行程。");
  } finally {
    release?.();
  }
}
