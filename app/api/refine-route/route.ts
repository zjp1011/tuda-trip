import { NextResponse } from "next/server";
import {
  createAgentTrace,
  getAgentTraces,
  saveAgentTrace,
} from "../../../lib/serverAgentTrace";
import {
  analyzeTravelPlan,
  buildAgentToolActions,
  detectAgentEditScope,
  type AgentEditScope,
  type AgentToolAction,
  type TravelPlanToolReport,
} from "../../../lib/travelPlanTools";
import { validateTravelPlan } from "../../../lib/travelPlanGuardrails";
import { formatUserMemoryForPrompt, normalizeMemoryPreferences } from "../../../lib/userMemory";
import {
  formatWeatherForPrompt,
  getDestinationWeather,
  type DestinationWeather,
} from "../../../lib/weatherTool";
import type { TravelPlan } from "../../../types/travel";

type RefineRouteRequestBody = {
  userId?: string;
  currentPlan?: TravelPlan;
  destination?: string;
  instruction?: string;
  userMemoryPreferences?: string[];
};

type RefineRouteResponse = {
  reply?: string;
  plan?: TravelPlan;
};

type AgentExecutionContext = {
  toolReport: TravelPlanToolReport;
  editScope: AgentEditScope;
  weather: DestinationWeather | null;
  actions: AgentToolAction[];
};

function isValidTravelPlan(plan: unknown): plan is TravelPlan {
  return (
    typeof plan === "object" &&
    plan !== null &&
    "plan_id" in plan &&
    "plan_title" in plan &&
    "highlights" in plan &&
    "budget_per_person" in plan &&
    "pace_rating" in plan &&
    "days" in plan
  );
}

function buildRefinePrompt(
  currentPlan: TravelPlan,
  instruction: string,
  userMemoryPreferences: string[],
  executionContext: AgentExecutionContext,
) {
  return `
你正在扮演“AI 行程管家”。用户已经有一份旅行行程，现在希望你根据一句自然语言指令修改它。

用户修改指令：
${instruction}

长期偏好记忆：
${formatUserMemoryForPrompt(userMemoryPreferences)}

天气工具结果：
${formatWeatherForPrompt(executionContext.weather)}

内部工具分析结果：
${JSON.stringify(executionContext.toolReport, null, 2)}

本轮 Agent 工具动作：
${JSON.stringify(executionContext.actions, null, 2)}

本轮编辑范围：
${JSON.stringify(executionContext.editScope, null, 2)}

当前行程 JSON：
${JSON.stringify(currentPlan, null, 2)}

请严格按以下要求输出：
1. 只输出 JSON，不要输出 Markdown、代码块或解释。
2. JSON 顶层必须包含 reply 和 plan 两个字段。
3. reply 用一句中文简短说明你做了什么修改。
4. plan 必须是完整 TravelPlan 对象，不要只返回 diff。
5. 除非用户明确要求改变天数，否则 days 数组长度必须保持不变。
6. day_number 必须连续且从 1 开始。
7. time_bucket 只能使用：上午、中午、下午、晚餐、晚上。
8. type 只能使用：spot、food、transit、rest。
9. 如果用户要求更松弛，要减少赶路、增加 rest 或缩短当天点位密度。
10. 如果用户提出忌口或饮食偏好，要替换 food 项并在 tips 中说明规避或替代建议。
11. 如果用户要求控制预算，要同步调整 budget_per_person、餐饮、住宿区域和活动建议。
12. 优先参考“内部工具分析结果”中的 warnings 和 suggestions，但不要在最终 JSON 中暴露工具报告。
13. 必须参考“本轮 Agent 工具动作”执行修改方向，例如预算约束、节奏优化、餐食替换或出片点规划。
14. 必须参考长期偏好记忆。如果长期记忆和本次修改指令冲突，以本次修改指令为准。
15. 如果“本轮编辑范围”为 single_day，必须尽量只修改 targetDayNumber 对应那一天；其它 days 的 schedule、theme、accommodation 应保持不变，除非为了预算或标题一致性必须轻微同步。
16. 必须参考天气工具结果。如果用户提到天气、下雨、高温、太冷、防晒或保暖，要优先调整室内外安排，并在 tips 中写清楚原因。

输出格式：
{
  "reply": "已将第 2 天调整得更松弛，并减少了跨区移动。",
  "plan": {
    "plan_id": "plan_1",
    "plan_title": "标题",
    "highlights": ["亮点"],
    "budget_per_person": "1200-1500元",
    "pace_rating": 4,
    "days": []
  }
}
`;
}

async function refineRouteWithLLM(
  currentPlan: TravelPlan,
  instruction: string,
  userMemoryPreferences: string[],
  executionContext: AgentExecutionContext,
) {
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
          content:
            "你是一个可靠的旅行规划 Agent，擅长基于已有结构化行程进行局部修改。你必须输出能被 JSON.parse 解析的 JSON。",
        },
        {
          role: "user",
          content: buildRefinePrompt(
            currentPlan,
            instruction,
            userMemoryPreferences,
            executionContext,
          ),
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
    throw new Error("DeepSeek returned an empty refine response.");
  }

  const parsed = JSON.parse(outputText) as RefineRouteResponse;

  if (!isValidTravelPlan(parsed.plan)) {
    throw new Error("DeepSeek returned an invalid TravelPlan.");
  }

  const guardrailResult = validateTravelPlan(parsed.plan, {
    expectedDays: currentPlan.days.length,
    protectedOriginalPlan: currentPlan,
    protectedTargetDayNumber:
      executionContext.editScope.mode === "single_day"
        ? executionContext.editScope.targetDayNumber
        : undefined,
  });

  if (!guardrailResult.passed) {
    const error = new Error(`Guardrails failed: ${guardrailResult.issues.join("；")}`);
    error.name = "GuardrailError";
    throw error;
  }

  return {
    reply: parsed.reply || "已按你的要求更新行程。",
    plan: parsed.plan,
    toolReport: executionContext.toolReport,
    editScope: executionContext.editScope,
    weather: executionContext.weather,
    actions: executionContext.actions,
    guardrailIssues: guardrailResult.issues,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const traces = await getAgentTraces(userId);
  return NextResponse.json({ traces });
}

export async function POST(request: Request) {
  let traceContext:
    | {
        userId?: string;
        instruction: string;
        userMemoryPreferences: string[];
        toolReport: TravelPlanToolReport;
        editScope: AgentEditScope;
        weather: DestinationWeather | null;
        actions: AgentToolAction[];
      }
    | null = null;

  try {
    const body = (await request.json()) as RefineRouteRequestBody;
    const instruction = body.instruction?.trim();

    if (!isValidTravelPlan(body.currentPlan)) {
      return NextResponse.json({ error: "currentPlan is required." }, { status: 400 });
    }

    if (!instruction) {
      return NextResponse.json({ error: "instruction is required." }, { status: 400 });
    }

    const userMemoryPreferences = normalizeMemoryPreferences(body.userMemoryPreferences);
    const toolReport = analyzeTravelPlan(body.currentPlan);
    const editScope = detectAgentEditScope(body.currentPlan, instruction);
    let weather: DestinationWeather | null = null;

    try {
      const destination = body.destination?.trim() || body.currentPlan.plan_title;
      weather = await getDestinationWeather(destination, body.currentPlan.days.length);
    } catch (error) {
      console.warn("Weather tool failed during refine:", error);
    }

    const actions = buildAgentToolActions(body.currentPlan, instruction, toolReport);
    traceContext = {
      userId: body.userId,
      instruction,
      userMemoryPreferences,
      toolReport,
      editScope,
      weather,
      actions,
    };
    const result = await refineRouteWithLLM(
      body.currentPlan,
      instruction,
      userMemoryPreferences,
      {
        toolReport,
        editScope,
        weather,
        actions,
      },
    );
    await saveAgentTrace(
      createAgentTrace({
        userId: body.userId,
        instruction,
        status: "success",
        reply: result.reply,
        editScope,
        actions,
        toolReport,
        weather,
        memoryPreferences: userMemoryPreferences,
        guardrailIssues: result.guardrailIssues,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (traceContext) {
      await saveAgentTrace(
        createAgentTrace({
          userId: traceContext.userId,
          instruction: traceContext.instruction,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown server error.",
          editScope: traceContext.editScope,
          actions: traceContext.actions,
          toolReport: traceContext.toolReport,
          weather: traceContext.weather,
          memoryPreferences: traceContext.userMemoryPreferences,
          guardrailIssues:
            error instanceof Error && error.name === "GuardrailError"
              ? error.message.replace("Guardrails failed: ", "").split("；")
              : [],
        }),
      );
    }

    return NextResponse.json(
      {
        error: "Failed to refine travel plan.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
