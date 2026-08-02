"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import ItineraryAgentPanel from "../components/ItineraryAgentPanel";
import PlanDisplay from "../components/PlanDisplay";
import SocialShareModal from "../components/SocialShareModal";
import UserMemoryPanel from "../components/UserMemoryPanel";
import WeatherInsightCard from "../components/WeatherInsightCard";
import { useUser } from "../hooks/useUser";
import { downloadTravelPlanHtml } from "../lib/exportTravelPlan";
import type { SavedTrip } from "../lib/savedTrips";
import { buildShareUrl, isLocalShareUrl } from "../lib/shareUrl";
import { defaultUserMemory, type UserMemory } from "../lib/userMemory";
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

const styleChips = ["历史文化", "自然风光", "特色街区", "美食探索", "松弛度假", "亲子友好"];
const foodPreferenceOptions = ["地道小吃", "网红餐厅", "夜市探店", "特色火锅", "甜品咖啡", "本地老店"];

const destinations = [
  { icon: "慢游", city: "成都", description: "火锅、茶馆与街巷慢生活。" },
  { icon: "海风", city: "厦门", description: "海风、老别墅与岛屿日落。" },
  { icon: "山海", city: "大理", description: "苍山洱海旁的松弛假期。" },
  { icon: "夜景", city: "上海", description: "城市漫游、展览与夜景。" },
];

export default function Home() {
  const router = useRouter();
  const { guestId } = useUser();
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [companion, setCompanion] = useState<CompanionType>("朋友");
  const [budgetPreference, setBudgetPreference] = useState<BudgetPreference>("舒适预算");
  const [customBudget, setCustomBudget] = useState("");
  const [travelStyles, setTravelStyles] = useState<string[]>(["自然风光"]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [customFoodPreference, setCustomFoodPreference] = useState("");
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [userMemory, setUserMemory] = useState<UserMemory>(defaultUserMemory);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [hasUnsavedAgentChanges, setHasUnsavedAgentChanges] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const city = new URLSearchParams(window.location.search).get("city");

    if (city) {
      setDestination(city);
    }
  }, []);

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
    setFoodPreferences((currentPreferences) =>
      currentPreferences.includes(preference)
        ? currentPreferences.filter((currentPreference) => currentPreference !== preference)
        : [...currentPreferences, preference],
    );
  };

  const updateCustomBudget = (value: string) => {
    setCustomBudget(value.replace(/[^\d]/g, ""));
  };

  const saveCurrentPlan = async () => {
    if (!plan) {
      return;
    }

    if (!guestId) {
      setErrorMessage("游客身份初始化中，请稍后再收藏。");
      return;
    }

    setErrorMessage("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/save-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: guestId,
          destination: destination || "未命名目的地",
          plan,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        setErrorMessage(data?.details ?? data?.error ?? "收藏行程失败");
        return;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "收藏行程失败");
      return;
    }

    setHasUnsavedAgentChanges(false);
    setSaveMessage("已收藏最新版，正在前往我的行程。");
    router.push("/diary");
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const shareCurrentPlan = async () => {
    if (!plan) {
      return;
    }

    setErrorMessage("");
    setShareMessage("");

    try {
      const savedTrip: SavedTrip = {
        id: crypto.randomUUID(),
        title: plan.plan_title,
        destination: destination || "未命名目的地",
        createdAt: new Date().toISOString(),
        plan,
      };

      const response = await fetch("/api/share-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ savedTrip }),
      });
      const data = (await response.json()) as {
        sharedRoute?: { id: string };
        error?: string;
        details?: string;
      };

      if (!response.ok || !data.sharedRoute) {
        throw new Error(data.details ?? data.error ?? "创建分享链接失败");
      }

      const shareUrl = buildShareUrl(data.sharedRoute.id);
      await copyTextToClipboard(shareUrl);
      setShareMessage(
        isLocalShareUrl(shareUrl)
          ? "本地分享链接已复制，但 localhost 只能在你这台电脑打开；外发需要先部署或配置公网访问地址。"
          : "分享链接已复制，可以直接发给朋友查看。",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建分享链接失败");
    }
  };

  const updatePlanFromAgent = (nextPlan: TravelPlan, reply: string) => {
    setPlan(nextPlan);
    setHasUnsavedAgentChanges(true);
    setSaveMessage(`${reply} 当前修改尚未收藏。`);
  };

  const downloadPlan = () => {
    if (!plan) {
      return;
    }

    downloadTravelPlanHtml(plan);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: guestId,
          userMemoryPreferences: userMemory.preferences,
          destination,
          days: Number(days),
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

      if (!data || !("plans" in data) || !data.plans[0]) {
        throw new Error("接口没有返回可展示的行程。");
      }

      setPlan(data.plans[0]);
      setHasUnsavedAgentChanges(false);
      setSaveMessage("");
      setShareMessage("");
      window.setTimeout(() => {
        document.getElementById("generated-plan")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成旅行方案失败");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center text-white"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgb(0 0 0 / 0.58), rgb(0 0 0 / 0.86)), url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85')",
      }}
    >
      <form onSubmit={handleSubmit}>
        <section className="px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-200">
              AI Travel Planner
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-5xl lg:text-6xl">
              踏上新的旅程
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-gray-200 sm:text-lg">
              从目的地到每日路线，用一个清晰的偏好输入，生成更懂你的旅行计划。
            </p>

            <div className="mt-10 flex w-full max-w-4xl flex-col gap-3 rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl shadow-black/20 backdrop-blur-md sm:rounded-full lg:flex-row lg:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white/10 px-5 py-4 text-left">
                <span className="text-white/70">搜索</span>
                <input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="想去哪里？例如 成都"
                  required
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/55"
                />
              </label>

              <label className="flex items-center gap-3 rounded-full bg-white/10 px-5 py-4 text-left lg:w-44">
                <span className="text-sm font-semibold text-white/70">天数</span>
                <select
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none [&>option]:text-gray-950"
                >
                  {Array.from({ length: 7 }, (_, index) => `${index + 1}`).map((day) => (
                    <option key={day} value={day}>
                      {day} 天
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isGenerating}
                className="rounded-full bg-gradient-to-r from-orange-400 to-red-400 px-7 py-4 text-sm font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-500/40 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? "生成中..." : "生成路线"}
              </button>
            </div>

            {errorMessage ? (
              <p className="mt-4 max-w-4xl rounded-2xl border border-red-300/30 bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-100 backdrop-blur-md">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="px-5 pb-8 sm:px-8 lg:px-12">
          <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-black/35 p-5 text-left backdrop-blur-md">
              <p className="text-sm font-black">同行人员</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {companionOptions.map((option) => {
                  const isSelected = companion === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCompanion(option)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        isSelected ? "bg-white text-gray-950" : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/35 p-5 text-left backdrop-blur-md">
              <p className="text-sm font-black">人均预算</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {budgetOptions.map((option) => {
                  const isSelected = budgetPreference === option.label;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setBudgetPreference(option.label)}
                      className={`rounded-2xl px-3 py-2 text-left transition-all ${
                        isSelected ? "bg-orange-400 text-white" : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      <span className="block text-xs font-black">{option.label}</span>
                      <span className="mt-1 block text-[11px] text-white/70">{option.description}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 flex items-center rounded-full bg-white/10 px-4 py-3">
                <input
                  value={customBudget}
                  onChange={(event) => updateCustomBudget(event.target.value)}
                  inputMode="numeric"
                  placeholder="自定义金额"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/45"
                />
                <span className="ml-3 text-xs font-bold text-white/60">元/人</span>
              </label>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/35 p-5 text-left backdrop-blur-md">
              <p className="text-sm font-black">
                旅游风格 <span className="text-xs text-white/45">{travelStyles.length}/3</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {styleChips.map((chip) => {
                  const isSelected = travelStyles.includes(chip);
                  const isDisabled = !isSelected && travelStyles.length >= 3;

                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleTravelStyle(chip)}
                      disabled={isDisabled}
                      className={`rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-md transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? "bg-white text-gray-950 shadow-lg shadow-white/10"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/35 p-5 text-left backdrop-blur-md lg:col-span-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">美食与饮食偏好</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {foodPreferenceOptions.map((preference) => {
                      const isSelected = foodPreferences.includes(preference);

                      return (
                        <button
                          key={preference}
                          type="button"
                          onClick={() => toggleFoodPreference(preference)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                            isSelected ? "bg-orange-400 text-white" : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {preference}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="w-full lg:max-w-sm">
                  <span className="text-xs font-semibold text-white/60">自定义口味</span>
                  <input
                    value={customFoodPreference}
                    onChange={(event) => setCustomFoodPreference(event.target.value)}
                    placeholder="例如：不吃辣、想吃清淡"
                    className="mt-2 w-full rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/45 focus:bg-white/15"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>
      </form>

      <WeatherInsightCard destination={destination} days={Number(days)} />

      <UserMemoryPanel guestId={guestId} onMemoryChanged={setUserMemory} />

      <section className="px-5 pb-10 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-4 rounded-3xl border border-white/15 bg-black/40 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
              Social Copy
            </p>
            <h2 className="mt-2 text-2xl font-black">小红书推荐文案，一键帮你写好</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              生成旅行路线后，页面会出现“一键生成发圈文案”按钮。可以切换小红书风或朋友圈风，AI 会根据你的行程亮点、景点和美食自动写成可编辑文案。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {["爆款标题", "亮点提炼", "照片九宫格预览", "可读行程卡下载"].map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/85"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-200">Popular Now</p>
              <h2 className="mt-1 text-2xl font-black">热门目的地</h2>
            </div>
            <p className="hidden text-sm text-gray-300 sm:block">点击城市后直接带入搜索框。</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((destinationItem) => (
              <button
                key={destinationItem.city}
                type="button"
                onClick={() => setDestination(destinationItem.city)}
                className="rounded-2xl border border-white/10 bg-black/40 p-5 text-left backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-black/50"
              >
                <span className="text-sm font-black text-orange-200">{destinationItem.icon}</span>
                <h3 className="mt-4 text-lg font-black">{destinationItem.city}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">
                  {destinationItem.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {plan ? (
        <section id="generated-plan" className="bg-[#070707] px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto mb-6 flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
                Generated Route
              </p>
              <h2 className="mt-2 text-3xl font-black">你的专属路线</h2>
              {saveMessage ? (
                <p className="mt-3 max-w-xl rounded-2xl border border-orange-200/20 bg-orange-300/10 px-4 py-3 text-sm font-semibold text-orange-100">
                  {saveMessage}
                </p>
              ) : null}
              {shareMessage ? (
                <p className="mt-3 max-w-xl rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                  {shareMessage}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <SocialShareModal tripSummary={plan} />
              <button
                type="button"
                onClick={shareCurrentPlan}
                className="rounded-full bg-orange-400 px-5 py-3 text-sm font-black text-white shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-orange-300"
              >
                分享链接
              </button>
              <button
                type="button"
                onClick={saveCurrentPlan}
                className={`rounded-full px-5 py-3 text-sm font-black transition-all hover:-translate-y-0.5 ${
                  hasUnsavedAgentChanges
                    ? "bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40"
                    : "bg-white text-slate-950 hover:bg-orange-100"
                }`}
              >
                {hasUnsavedAgentChanges ? "收藏最新版" : "收藏行程"}
              </button>
              <button
                type="button"
                onClick={downloadPlan}
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                下载行程卡
              </button>
            </div>
          </div>
          <ItineraryAgentPanel
            userId={guestId}
            plan={plan}
            destination={destination}
            memoryPreferences={userMemory.preferences}
            onPlanUpdated={updatePlanFromAgent}
          />
          <PlanDisplay plan={plan} />
        </section>
      ) : null}
    </div>
  );
}
