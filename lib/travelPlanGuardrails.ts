import type { ScheduleItemType, TimeBucket, TravelPlan } from "../types/travel";

export type GuardrailResult = {
  passed: boolean;
  issues: string[];
};

const allowedTimeBuckets = new Set<TimeBucket>(["上午", "中午", "下午", "晚餐", "晚上"]);
const allowedScheduleTypes = new Set<ScheduleItemType>(["spot", "food", "transit", "rest"]);

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isRenderableTravelPlan(value: unknown): value is TravelPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as TravelPlan;
  return isNonEmptyString(plan.plan_id) &&
    isNonEmptyString(plan.plan_title) &&
    Array.isArray(plan.highlights) &&
    plan.highlights.length <= 30 &&
    plan.highlights.every((highlight) => typeof highlight === "string") &&
    typeof plan.budget_per_person === "string" &&
    Number.isFinite(plan.pace_rating) &&
    Array.isArray(plan.days) &&
    plan.days.length >= 1 &&
    plan.days.length <= 7 &&
    plan.days.every((day) => day &&
      Number.isInteger(day.day_number) &&
      typeof day.day_theme === "string" &&
      day.accommodation &&
      typeof day.accommodation.area_recommendation === "string" &&
      typeof day.accommodation.reason === "string" &&
      Array.isArray(day.schedule) &&
      day.schedule.length <= 20 &&
      day.schedule.every((item) => item &&
        allowedTimeBuckets.has(item.time_bucket) &&
        allowedScheduleTypes.has(item.type) &&
        [item.location, item.activity, item.duration, item.tips].every((field) => typeof field === "string")));
}

export function validateTravelPlan(
  plan: TravelPlan,
  options?: {
    expectedDays?: number;
    protectedOriginalPlan?: TravelPlan;
    protectedTargetDayNumber?: number;
  },
): GuardrailResult {
  const issues: string[] = [];

  if (!isNonEmptyString(plan.plan_id)) {
    issues.push("plan_id 不能为空。");
  }

  if (!isNonEmptyString(plan.plan_title)) {
    issues.push("plan_title 不能为空。");
  }

  if (!Array.isArray(plan.highlights) || plan.highlights.length === 0) {
    issues.push("highlights 至少需要 1 条。");
  }

  if (!isNonEmptyString(plan.budget_per_person)) {
    issues.push("budget_per_person 不能为空。");
  }

  if (!Number.isFinite(plan.pace_rating) || plan.pace_rating < 1 || plan.pace_rating > 5) {
    issues.push("pace_rating 必须是 1-5 的数字。");
  }

  if (!Array.isArray(plan.days) || plan.days.length === 0) {
    issues.push("days 不能为空。");
  }

  if (options?.expectedDays && plan.days.length !== options.expectedDays) {
    issues.push(`days 数量必须保持为 ${options.expectedDays} 天。`);
  }

  plan.days.forEach((day, dayIndex) => {
    const expectedDayNumber = dayIndex + 1;

    if (day.day_number !== expectedDayNumber) {
      issues.push(`day_number 必须连续，当前第 ${dayIndex + 1} 项不是 ${expectedDayNumber}。`);
    }

    if (!isNonEmptyString(day.day_theme)) {
      issues.push(`Day ${day.day_number} day_theme 不能为空。`);
    }

    if (!Array.isArray(day.schedule) || day.schedule.length === 0) {
      issues.push(`Day ${day.day_number} schedule 不能为空。`);
    }

    day.schedule.forEach((item, itemIndex) => {
      const label = `Day ${day.day_number} 第 ${itemIndex + 1} 个节点`;

      if (!allowedTimeBuckets.has(item.time_bucket)) {
        issues.push(`${label} time_bucket 不合法：${item.time_bucket}`);
      }

      if (!allowedScheduleTypes.has(item.type)) {
        issues.push(`${label} type 不合法：${item.type}`);
      }

      if (!isNonEmptyString(item.location)) {
        issues.push(`${label} location 不能为空。`);
      }

      if (!isNonEmptyString(item.activity)) {
        issues.push(`${label} activity 不能为空。`);
      }

      if (!isNonEmptyString(item.duration)) {
        issues.push(`${label} duration 不能为空。`);
      }

      if (!isNonEmptyString(item.tips)) {
        issues.push(`${label} tips 不能为空。`);
      }
    });

    if (!day.accommodation || !isNonEmptyString(day.accommodation.area_recommendation)) {
      issues.push(`Day ${day.day_number} accommodation.area_recommendation 不能为空。`);
    }

    if (!day.accommodation || !isNonEmptyString(day.accommodation.reason)) {
      issues.push(`Day ${day.day_number} accommodation.reason 不能为空。`);
    }
  });

  const protectedOriginalPlan = options?.protectedOriginalPlan;
  const protectedTargetDayNumber = options?.protectedTargetDayNumber;

  if (protectedOriginalPlan && protectedTargetDayNumber) {
    protectedOriginalPlan.days.forEach((originalDay) => {
      if (originalDay.day_number === protectedTargetDayNumber) {
        return;
      }

      const nextDay = plan.days.find((day) => day.day_number === originalDay.day_number);

      if (!nextDay) {
        issues.push(`局部编辑不应删除 Day ${originalDay.day_number}。`);
        return;
      }

      if (JSON.stringify(nextDay) !== JSON.stringify(originalDay)) {
        issues.push(`局部编辑模式下 Day ${originalDay.day_number} 不应被修改。`);
      }
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
