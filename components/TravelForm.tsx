"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { TravelPlan, TravelPlansResponse } from "../types/travel";

type CompanionType = "单人" | "情侣" | "亲子" | "朋友";
type BudgetPreference = "经济实惠" | "舒适预算" | "品质享受" | "不设上限";

const companionOptions: CompanionType[] = ["单人", "情侣", "亲子", "朋友"];

const budgetOptions: Array<{
  label: BudgetPreference;
  description: string;
}> = [
  { label: "经济实惠", description: "500元以内/人" },
  { label: "舒适预算", description: "500-1500元/人" },
  { label: "品质享受", description: "1500-3000元/人" },
  { label: "不设上限", description: "3000元以上/人" },
];

const travelStyleOptions = [
  "出片打卡",
  "美食狂欢",
  "松弛躺平",
  "自然风光",
  "城市漫游",
  "文化体验",
];

const foodPreferenceOptions = [
  "地道小吃",
  "网红餐厅",
  "夜市探店",
  "特色火锅",
  "甜品咖啡",
  "本地老店",
];

const chipClassName =
  "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed";

const selectedChipClassName = "bg-orange-500 text-white shadow-lg shadow-orange-500/30";

const unselectedChipClassName = "bg-slate-100 text-slate-600 hover:bg-white hover:shadow-md";

interface TravelFormProps {
  onPlanGenerated?: (plan: TravelPlan) => void;
}

export default function TravelForm({ onPlanGenerated }: TravelFormProps) {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [companion, setCompanion] = useState<CompanionType>("朋友");
  const [budgetPreference, setBudgetPreference] = useState<BudgetPreference>("舒适预算");
  const [customBudget, setCustomBudget] = useState("");
  const [travelStyles, setTravelStyles] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [customFoodPreference, setCustomFoodPreference] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const toggleTravelStyle = (style: string) => {
    setTravelStyles((currentStyles) => {
      if (currentStyles.includes(style)) {
        return currentStyles.filter((currentStyle) => currentStyle !== style);
      }

      if (currentStyles.length >= 3) {
        return currentStyles;
      }

      return [...currentStyles, style];
    });
  };

  const toggleFoodPreference = (preference: string) => {
    setFoodPreferences((currentPreferences) => {
      if (currentPreferences.includes(preference)) {
        return currentPreferences.filter(
          (currentPreference) => currentPreference !== preference,
        );
      }

      return [...currentPreferences, preference];
    });
  };

  const updateDays = (value: string) => {
    const nextDays = Number(value);

    if (Number.isNaN(nextDays)) {
      setDays(1);
      return;
    }

    setDays(Math.min(7, Math.max(1, nextDays)));
  };

  const updateCustomBudget = (value: string) => {
    const normalizedValue = value.replace(/[^\d]/g, "");
    setCustomBudget(normalizedValue);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination,
          days,
          companion,
          budgetPreference,
          customBudget,
          travelStyles,
          foodPreferences,
          customFoodPreference,
        }),
      });

      const responseText = await response.text();
      let data: TravelPlansResponse | { error?: string; details?: string } | null = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText) as TravelPlansResponse | {
            error?: string;
            details?: string;
          };
        } catch {
          throw new Error("接口返回了非 JSON 内容，请查看服务端日志。");
        }
      }

      if (!response.ok) {
        const errorText =
          data && "error" in data && data.error
            ? data.details
              ? `${data.error}: ${data.details}`
              : data.error
            : "生成旅行方案失败";
        throw new Error(errorText);
      }

      if (!data) {
        throw new Error("接口没有返回内容");
      }

      console.log(data);

      if ("plans" in data && data.plans[0]) {
        onPlanGenerated?.(data.plans[0]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成旅行方案失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-xl rounded-3xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8"
    >
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-500">
          Travel Buddy
        </p>
        <h2 className="text-3xl font-black tracking-normal text-orange-600 sm:text-4xl">
          定制你的旅行计划
        </h2>
        <p className="max-w-sm text-sm leading-6 text-slate-500">
          输入目的地、口味和同行方式，生成一份像本地朋友写给你的路线。
        </p>
      </div>

      <div className="mt-8 space-y-7">
        <label className="block">
          <span className="text-sm font-bold text-slate-800">目的地</span>
          <input
            type="text"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="例如：成都、厦门、东京"
            disabled={isLoading}
            className="mt-3 w-full rounded-3xl border border-white/60 bg-white/70 px-5 py-4 text-sm font-medium text-slate-950 shadow-inner outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-orange-500/20"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-800">游玩天数</span>
          <input
            type="number"
            min={1}
            max={7}
            value={days}
            onChange={(event) => updateDays(event.target.value)}
            disabled={isLoading}
            className="mt-3 w-full rounded-3xl border border-white/60 bg-white/70 px-5 py-4 text-sm font-medium text-slate-950 shadow-inner outline-none transition-all duration-300 focus:bg-white focus:ring-4 focus:ring-orange-500/20"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">同行人员</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {companionOptions.map((option) => {
              const isSelected = companion === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCompanion(option)}
                  disabled={isLoading}
                  className={`rounded-3xl px-4 py-3 text-sm font-bold transition-all duration-300 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-xl shadow-slate-950/20"
                      : "bg-slate-100 text-slate-600 hover:bg-white hover:shadow-md"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-slate-500">自定义人均金额</span>
            <div className="mt-2 flex items-center rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-inner transition-all duration-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/20">
              <input
                type="text"
                inputMode="numeric"
                value={customBudget}
                onChange={(event) => updateCustomBudget(event.target.value)}
                placeholder="例如：800"
                disabled={isLoading}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
              />
              <span className="ml-3 shrink-0 text-sm font-bold text-slate-400">元/人</span>
            </div>
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">人均预算</legend>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {budgetOptions.map((option) => {
              const isSelected = budgetPreference === option.label;

              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setBudgetPreference(option.label)}
                  disabled={isLoading}
                  className={`rounded-3xl px-4 py-3 text-left transition-all duration-300 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : "bg-slate-100 text-slate-600 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span
                    className={`mt-1 block text-xs font-semibold ${
                      isSelected ? "text-orange-50" : "text-slate-400"
                    }`}
                  >
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">
            旅游风格
            <span className="ml-2 text-xs font-semibold text-slate-400">{travelStyles.length}/3</span>
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {travelStyleOptions.map((style) => {
              const isSelected = travelStyles.includes(style);
              const isDisabled = !isSelected && travelStyles.length >= 3;

              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleTravelStyle(style)}
                  disabled={isDisabled || isLoading}
                  className={`${chipClassName} ${
                    isSelected ? selectedChipClassName : unselectedChipClassName
                  } ${isDisabled ? "opacity-40" : ""}`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-slate-800">美食与饮食偏好</legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {foodPreferenceOptions.map((preference) => {
              const isSelected = foodPreferences.includes(preference);

              return (
                <button
                  key={preference}
                  type="button"
                  onClick={() => toggleFoodPreference(preference)}
                  disabled={isLoading}
                  className={`${chipClassName} ${
                    isSelected ? selectedChipClassName : unselectedChipClassName
                  }`}
                >
                  {preference}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            value={customFoodPreference}
            onChange={(event) => setCustomFoodPreference(event.target.value)}
            placeholder="自定义：例如不吃辣、想吃清淡、必吃当地早餐"
            disabled={isLoading}
            className="mt-3 w-full rounded-3xl border border-white/60 bg-white/70 px-5 py-4 text-sm font-medium text-slate-950 shadow-inner outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-orange-500/20"
          />
        </fieldset>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-3xl border border-rose-200/60 bg-rose-50/80 px-5 py-4 text-sm font-medium text-rose-700 shadow-sm backdrop-blur-xl">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-8 w-full rounded-3xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-orange-500/30 transition-all duration-300 hover:-translate-y-1 hover:bg-orange-600 hover:shadow-2xl hover:shadow-orange-500/40 focus:outline-none focus:ring-4 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {isLoading ? "加载中..." : "生成旅行方案"}
      </button>
    </form>
  );
}
