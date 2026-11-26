import type { ScheduleItemType, TravelPlan } from "../types/travel";

type DayToolReport = {
  dayNumber: number;
  theme: string;
  scheduleCount: number;
  foodCount: number;
  restCount: number;
  transitCount: number;
  spotCount: number;
  status: "轻松" | "均衡" | "偏满";
};

export type TravelPlanToolReport = {
  paceLabel: "紧凑" | "均衡" | "松弛";
  totalScheduleCount: number;
  totalFoodCount: number;
  totalRestCount: number;
  dayReports: DayToolReport[];
  warnings: string[];
  suggestions: string[];
};

export type AgentIntent =
  | "relax_pace"
  | "replace_food"
  | "add_photo_spot"
  | "control_budget"
  | "weather_adjust"
  | "optimize_by_report"
  | "general_refine";

export type AgentToolAction = {
  toolName: string;
  label: string;
  status: "done" | "skipped";
  detail: string;
};

export type AgentEditScope = {
  mode: "entire_plan" | "single_day";
  targetDayNumber?: number;
  targetDayTheme?: string;
};

const typeCounterInitialValue: Record<ScheduleItemType, number> = {
  spot: 0,
  food: 0,
  transit: 0,
  rest: 0,
};

function getPaceLabel(paceRating: number): TravelPlanToolReport["paceLabel"] {
  if (paceRating <= 2) {
    return "紧凑";
  }

  if (paceRating >= 4) {
    return "松弛";
  }

  return "均衡";
}

function getDayStatus(
  scheduleCount: number,
  transitCount: number,
  restCount: number,
): DayToolReport["status"] {
  if (scheduleCount >= 5 || transitCount >= 2) {
    return "偏满";
  }

  if (scheduleCount <= 3 || restCount >= 1) {
    return "轻松";
  }

  return "均衡";
}

export function analyzeTravelPlan(plan: TravelPlan): TravelPlanToolReport {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const dayReports = plan.days.map((day) => {
    const counts = day.schedule.reduce<Record<ScheduleItemType, number>>(
      (result, item) => ({
        ...result,
        [item.type]: result[item.type] + 1,
      }),
      { ...typeCounterInitialValue },
    );
    const status = getDayStatus(day.schedule.length, counts.transit, counts.rest);

    if (status === "偏满") {
      warnings.push(`Day ${day.day_number} 安排偏满，可能需要减少跨区移动或增加休息。`);
    }

    if (counts.food === 0) {
      warnings.push(`Day ${day.day_number} 没有明确美食安排，路线记忆点会弱一些。`);
    }

    return {
      dayNumber: day.day_number,
      theme: day.day_theme,
      scheduleCount: day.schedule.length,
      foodCount: counts.food,
      restCount: counts.rest,
      transitCount: counts.transit,
      spotCount: counts.spot,
      status,
    };
  });

  const totalScheduleCount = dayReports.reduce((sum, day) => sum + day.scheduleCount, 0);
  const totalFoodCount = dayReports.reduce((sum, day) => sum + day.foodCount, 0);
  const totalRestCount = dayReports.reduce((sum, day) => sum + day.restCount, 0);
  const averageScheduleCount = plan.days.length > 0 ? totalScheduleCount / plan.days.length : 0;
  const paceLabel = getPaceLabel(plan.pace_rating);

  if (paceLabel === "紧凑" || averageScheduleCount >= 4.5) {
    suggestions.push("如果用户想要松弛感，优先减少单日点位，并把远距离移动拆到不同天。");
  }

  if (totalRestCount === 0) {
    suggestions.push("建议至少加入 1 个 rest 节点，例如咖啡店、茶馆或酒店休息。");
  }

  if (totalFoodCount < plan.days.length) {
    suggestions.push("建议保证每天至少 1 个 food 节点，尤其适合小红书分享和本地体验。");
  }

  if (warnings.length === 0) {
    suggestions.push("当前行程结构比较稳定，可以按用户指令做局部微调，不必大幅重写。");
  }

  return {
    paceLabel,
    totalScheduleCount,
    totalFoodCount,
    totalRestCount,
    dayReports,
    warnings,
    suggestions,
  };
}

export function detectAgentIntent(instruction: string): AgentIntent {
  const normalizedInstruction = instruction.toLowerCase();

  if (/体检|优化|建议|检查/.test(instruction)) {
    return "optimize_by_report";
  }

  if (/松弛|轻松|太累|少走|休息|慢一点/.test(instruction)) {
    return "relax_pace";
  }

  if (/不想吃|不吃|忌口|换.*吃|美食|火锅|小吃|餐厅/.test(instruction)) {
    return "replace_food";
  }

  if (/拍照|出片|日落|夜景|机位|打卡/.test(instruction)) {
    return "add_photo_spot";
  }

  if (/预算|人均|便宜|省钱|控制|花费|价格/.test(instruction) || /\d+\s*元/.test(instruction)) {
    return "control_budget";
  }

  if (/天气|下雨|雨天|太热|高温|太冷|降温|防晒|保暖/.test(instruction)) {
    return "weather_adjust";
  }

  if (normalizedInstruction.includes("budget")) {
    return "control_budget";
  }

  return "general_refine";
}

export function detectAgentEditScope(plan: TravelPlan, instruction: string): AgentEditScope {
  const targetDayPatterns = [
    /day\s*(\d+)/i,
    /第\s*(\d+)\s*天/,
    /第\s*([一二三四五六七])\s*天/,
  ];
  const chineseNumberMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
  };

  for (const pattern of targetDayPatterns) {
    const match = instruction.match(pattern);
    const rawDayNumber = match?.[1];

    if (!rawDayNumber) {
      continue;
    }

    const targetDayNumber =
      rawDayNumber in chineseNumberMap
        ? chineseNumberMap[rawDayNumber]
        : Number(rawDayNumber);
    const targetDay = plan.days.find((day) => day.day_number === targetDayNumber);

    if (targetDay) {
      return {
        mode: "single_day",
        targetDayNumber,
        targetDayTheme: targetDay.day_theme,
      };
    }
  }

  return {
    mode: "entire_plan",
  };
}

export function buildAgentToolActions(
  plan: TravelPlan,
  instruction: string,
  report = analyzeTravelPlan(plan),
  forecastDays = 0,
): AgentToolAction[] {
  const intent = detectAgentIntent(instruction);
  const editScope = detectAgentEditScope(plan, instruction);
  const actions: AgentToolAction[] = [
    {
      toolName: "intent_detector",
      label: "识别用户意图",
      status: "done",
      detail: `判断为：${getIntentLabel(intent)}`,
    },
    {
      toolName: "edit_scope_resolver",
      label: "确定编辑范围",
      status: "done",
      detail:
        editScope.mode === "single_day"
          ? `锁定 Day ${editScope.targetDayNumber}：${editScope.targetDayTheme}，优先只改这一天。`
          : "未指定具体天数，按整份路线做全局优化。",
    },
    {
      toolName: "itinerary_diagnosis",
      label: "体检当前行程",
      status: "done",
      detail: `节奏${report.paceLabel}，美食 ${report.totalFoodCount} 个，休整 ${report.totalRestCount} 个。`,
    },
  ];

  if (intent === "relax_pace" || intent === "optimize_by_report") {
    const crowdedDays = report.dayReports
      .filter((day) => day.status === "偏满")
      .map((day) => `Day ${day.dayNumber}`)
      .join("、");
    actions.push({
      toolName: "pace_optimizer",
      label: "优化行程节奏",
      status: "done",
      detail: crowdedDays
        ? `优先处理 ${crowdedDays}，减少点位或增加休整。`
        : "当前没有明显偏满天数，做轻量节奏微调。",
    });
  }

  if (intent === "replace_food" || intent === "optimize_by_report") {
    actions.push({
      toolName: "food_preference_rewriter",
      label: "重写餐食节点",
      status: "done",
      detail: "检查 food 节点与用户口味，替换不符合偏好的餐食建议。",
    });
  }

  if (intent === "add_photo_spot") {
    actions.push({
      toolName: "photo_spot_planner",
      label: "增加出片点",
      status: "done",
      detail: "优先寻找日落、夜景、街区或自然景观点，并避免打乱原本节奏。",
    });
  }

  if (intent === "control_budget" || intent === "optimize_by_report") {
    actions.push({
      toolName: "budget_guard",
      label: "预算约束检查",
      status: "done",
      detail: "同步检查住宿区域、餐饮选择、交通方式与 budget_per_person。",
    });
  }

  if (intent === "weather_adjust" || intent === "optimize_by_report") {
    actions.push({
      toolName: "weather_tool",
      label: "查询目的地天气",
      status: forecastDays > 0 ? "done" : "skipped",
      detail: forecastDays > 0
        ? `已获取行程日期内 ${forecastDays} 天的预报，可据此调整室内外安排。`
        : "暂无与这次行程匹配的预报，未使用天气数据。",
    });
  }

  actions.push({
    toolName: "schema_validator",
    label: "校验结构化输出",
    status: "done",
    detail: "保持 TravelPlan 完整结构，确保前端时间轴可以直接渲染。",
  });

  return actions;
}

export function getIntentLabel(intent: AgentIntent) {
  const labels: Record<AgentIntent, string> = {
    relax_pace: "放松节奏",
    replace_food: "调整美食偏好",
    add_photo_spot: "增加出片点",
    control_budget: "控制预算",
    weather_adjust: "按天气调整",
    optimize_by_report: "按体检结果优化",
    general_refine: "通用行程修改",
  };

  return labels[intent];
}
