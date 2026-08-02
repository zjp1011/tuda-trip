import { NextResponse } from "next/server";
import { generateEmbedding } from "../../../lib/openai";
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
};

type TravelCacheMetadata = {
  travelPlanJson?: string;
  cacheKeyText?: string;
  createdAt?: string;
};

const CACHE_HIT_THRESHOLD = 0.95;
const UPSTASH_TIMEOUT_MS = 2500;

function normalizeRequestBody(body: GenerateRequestBody): NormalizedGenerateRequest | null {
  const destination = body.destination?.trim();
  const days = Number(body.days);
  const companion = body.companion?.trim();
  const budgetPreference = body.budgetPreference?.trim() || "舒适预算";
  const customBudget = body.customBudget?.trim().replace(/[^\d]/g, "") ?? "";
  const travelStyles = Array.isArray(body.travelStyles) ? body.travelStyles.slice(0, 3) : [];
  const foodPreferences = Array.isArray(body.foodPreferences) ? body.foodPreferences : [];
  const customFoodPreference = body.customFoodPreference?.trim() ?? "";

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
  };
}

function buildCacheKeyText(body: NormalizedGenerateRequest) {
  return [
    body.destination,
    `${body.days}天`,
    body.companion,
    body.budgetPreference,
    body.customBudget ? `自定义人均${body.customBudget}元` : "",
    ...body.travelStyles,
    ...body.foodPreferences,
    body.customFoodPreference,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUserPrompt(body: NormalizedGenerateRequest) {
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
  } catch (error) {
    console.warn("Upstash cache query failed, falling back to LLM:", error);
    return null;
  }
}

async function generateTravelPlanWithLLM(body: NormalizedGenerateRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing environment variable: DEEPSEEK_API_KEY");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: "你是一个资深旅行规划师。你必须输出能被 JSON.parse 解析的 JSON。",
        },
        {
          role: "user",
          content: buildUserPrompt(body),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 4000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed: ${errorText}`);
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

  return JSON.parse(outputText) as TravelPlansResponse;
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
  } catch (error) {
    console.warn("Upstash cache upsert failed:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const normalizedBody = normalizeRequestBody(body);

    if (!normalizedBody) {
      return NextResponse.json(
        { error: "Invalid request. destination, days(1-7), and companion are required." },
        { status: 400 },
      );
    }

    const cacheKeyText = buildCacheKeyText(normalizedBody);
    const embedding = await generateEmbedding(cacheKeyText);
    const cachedTravelPlan = await queryTravelPlanCache(embedding);

    if (cachedTravelPlan) {
      return NextResponse.json(cachedTravelPlan);
    }

    const travelPlan = await generateTravelPlanWithLLM(normalizedBody);
    await upsertTravelPlanCache(embedding, cacheKeyText, travelPlan);

    console.log("🐌 新生成并已缓存");
    return NextResponse.json(travelPlan);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate travel plan.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
