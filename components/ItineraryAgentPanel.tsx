"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { analyzeTravelPlan, type AgentToolAction } from "../lib/travelPlanTools";
import type { TravelPlan } from "../types/travel";

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

type ItineraryAgentPanelProps = {
  userId?: string;
  plan: TravelPlan;
  destination?: string;
  memoryPreferences?: string[];
  onPlanUpdated: (plan: TravelPlan, reply: string) => void;
};

const quickInstructions = [
  "根据体检结果，帮我优化这份路线",
  "第二天太累了，帮我改松弛一点",
  "我不想吃火锅，换成本地小吃",
  "加一个适合拍照的日落点",
  "把预算控制在人均 1200 元以内",
  "根据天气调整室内外安排",
];

export default function ItineraryAgentPanel({
  userId = "",
  plan,
  destination = "",
  memoryPreferences = [],
  onPlanUpdated,
}: ItineraryAgentPanelProps) {
  const toolReport = analyzeTravelPlan(plan);
  const [instruction, setInstruction] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: "assistant",
      content: "我是你的 AI 行程管家。你可以直接说想怎么改，我会先体检路线、选择工具，再更新当前行程。",
    },
  ]);
  const [lastActions, setLastActions] = useState<AgentToolAction[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refinePlan = async (nextInstruction: string) => {
    const trimmedInstruction = nextInstruction.trim();

    if (!trimmedInstruction || isRefining) {
      return;
    }

    setInstruction("");
    setErrorMessage("");
    setIsRefining(true);
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: trimmedInstruction },
    ]);

    try {
      const response = await fetch("/api/refine-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          currentPlan: plan,
          destination,
          instruction: trimmedInstruction,
          userMemoryPreferences: memoryPreferences,
        }),
      });

      const responseText = await response.text();
      let data: {
        reply?: string;
        plan?: TravelPlan;
        actions?: AgentToolAction[];
        error?: string;
        details?: string;
      } | null = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText) as {
            reply?: string;
            plan?: TravelPlan;
            actions?: AgentToolAction[];
            error?: string;
            details?: string;
          };
        } catch {
          throw new Error("行程管家接口返回了非 JSON 内容，请查看服务端日志。");
        }
      }

      if (!response.ok) {
        throw new Error(data?.details ?? data?.error ?? "行程修改失败");
      }

      if (!data?.plan) {
        throw new Error("行程管家没有返回新的行程。");
      }

      const reply = data.reply ?? "已按你的要求更新行程。";
      setLastActions(data.actions ?? []);
      onPlanUpdated(data.plan, reply);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: `${reply} 修改后的路线已更新到下方，记得收藏最新版。`,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "行程修改失败";
      setErrorMessage(message);
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: message },
      ]);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void refinePlan(instruction);
  };

  return (
    <section className="mx-auto mb-6 w-full max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-200">
            AI Trip Agent
          </p>
          <h3 className="mt-3 text-2xl font-black">AI 行程管家</h3>
          <p className="mt-3 text-sm leading-6 text-white/55">
            生成路线后不用从头再来，直接告诉它你想怎么改。它会识别意图、调用内部工具体检路线，并返回一版新的完整路线。
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs font-semibold text-white/40">节奏判断</p>
              <p className="mt-1 text-lg font-black text-orange-200">{toolReport.paceLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs font-semibold text-white/40">美食节点</p>
              <p className="mt-1 text-lg font-black text-orange-200">{toolReport.totalFoodCount} 个</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-xs font-semibold text-white/40">休整节点</p>
              <p className="mt-1 text-lg font-black text-orange-200">{toolReport.totalRestCount} 个</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Tool Check
            </p>
            <div className="mt-3 space-y-2">
              {(toolReport.warnings.length > 0 ? toolReport.warnings : toolReport.suggestions)
                .slice(0, 2)
                .map((item) => (
                  <p key={item} className="text-xs leading-5 text-white/55">
                    {item}
                  </p>
                ))}
            </div>
          </div>

          {memoryPreferences.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-orange-200/15 bg-orange-300/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-100/60">
                Memory Used
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {memoryPreferences.map((preference) => (
                  <span
                    key={preference}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/75"
                  >
                    {preference}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {quickInstructions.map((quickInstruction) => (
              <button
                key={quickInstruction}
                type="button"
                onClick={() => refinePlan(quickInstruction)}
                disabled={isRefining}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-left text-xs font-bold text-white/75 transition-all hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quickInstruction}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Day Tools
            </p>
            <div className="mt-3 grid gap-3">
              {plan.days.map((day) => (
                <div
                  key={day.day_number}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-black text-white">Day {day.day_number}</p>
                    <p className="text-xs text-white/45">{day.day_theme}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => refinePlan(`只修改 Day ${day.day_number}：让这一天更松弛，减少赶路并加入休整。`)}
                      disabled={isRefining}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70 transition-all hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      放松当天
                    </button>
                    <button
                      type="button"
                      onClick={() => refinePlan(`只修改 Day ${day.day_number}：替换或优化当天美食安排，优先本地小吃。`)}
                      disabled={isRefining}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70 transition-all hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      换美食
                    </button>
                    <button
                      type="button"
                      onClick={() => refinePlan(`只修改 Day ${day.day_number}：增加一个适合拍照出片的景点或日落点。`)}
                      disabled={isRefining}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70 transition-all hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      加出片点
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          {lastActions.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-orange-200/15 bg-orange-300/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-100/60">
                Agent Run
              </p>
              <div className="mt-3 grid gap-2">
                {lastActions.map((action) => (
                  <div
                    key={`${action.toolName}-${action.label}`}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-white">{action.label}</p>
                      <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] font-black text-emerald-200">
                        DONE
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-white/50">{action.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-8 bg-orange-400 text-white"
                    : "mr-8 bg-white/10 text-white/70"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-100">
              {errorMessage}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="例如：把第 3 天改成亲子友好一点"
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-orange-300/50"
            />
            <button
              type="submit"
              disabled={isRefining || !instruction.trim()}
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefining ? "修改中..." : "让它修改"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
