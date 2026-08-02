"use client";

import { useEffect, useState } from "react";
import PlanDisplay from "../../components/PlanDisplay";
import SocialShareModal from "../../components/SocialShareModal";
import { useUser } from "../../hooks/useUser";
import { downloadTravelPlanHtml } from "../../lib/exportTravelPlan";
import type { AgentTrace } from "../../lib/serverAgentTrace";
import { buildShareUrl, isLocalShareUrl } from "../../lib/shareUrl";
import {
  LEGACY_SAVED_TRIPS_STORAGE_KEY,
  SAVED_TRIPS_STORAGE_KEY,
  type SavedTrip,
} from "../../lib/savedTrips";

function readLegacySavedTrips() {
  const savedTripsJson =
    window.localStorage.getItem(SAVED_TRIPS_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SAVED_TRIPS_STORAGE_KEY);

  if (!savedTripsJson) {
    return [];
  }

  try {
    const parsedSavedTrips = JSON.parse(savedTripsJson) as SavedTrip[];
    window.localStorage.setItem(SAVED_TRIPS_STORAGE_KEY, JSON.stringify(parsedSavedTrips));
    window.localStorage.removeItem(LEGACY_SAVED_TRIPS_STORAGE_KEY);
    return parsedSavedTrips;
  } catch {
    window.localStorage.removeItem(SAVED_TRIPS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_SAVED_TRIPS_STORAGE_KEY);
    return [];
  }
}

async function copyTextToClipboard(text: string) {
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
}

export default function DiaryPage() {
  const { guestId } = useUser();
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);
  const [agentTraces, setAgentTraces] = useState<AgentTrace[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!guestId) {
      return;
    }

    const loadTrips = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const legacyTrips = readLegacySavedTrips();

        if (legacyTrips.length > 0) {
          await Promise.all(
            legacyTrips.map((trip) =>
              fetch("/api/save-route", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: guestId,
                  destination: trip.destination,
                  plan: trip.plan,
                }),
              }),
            ),
          );
          window.localStorage.removeItem(SAVED_TRIPS_STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_SAVED_TRIPS_STORAGE_KEY);
        }

        const response = await fetch(`/api/save-route?userId=${encodeURIComponent(guestId)}`);
        const data = (await response.json()) as { trips?: SavedTrip[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "获取收藏行程失败");
        }

        const trips = data.trips ?? [];
        setSavedTrips(trips);
        setSelectedTrip(trips[0] ?? null);

        const traceResponse = await fetch(`/api/refine-route?userId=${encodeURIComponent(guestId)}`);
        const traceData = (await traceResponse.json()) as {
          traces?: AgentTrace[];
          error?: string;
        };

        if (traceResponse.ok) {
          setAgentTraces(traceData.traces ?? []);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "获取收藏行程失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrips();
  }, [guestId]);

  const removeSavedTrip = async (savedTripId: string) => {
    if (!guestId) {
      return;
    }

    const response = await fetch("/api/save-route", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: guestId,
        tripId: savedTripId,
      }),
    });

    const data = (await response.json().catch(() => null)) as {
      trips?: SavedTrip[];
      error?: string;
    } | null;

    if (!response.ok) {
      setErrorMessage(data?.error ?? "移除收藏失败");
      return;
    }

    const nextSavedTrips = data?.trips ?? savedTrips.filter((savedTrip) => savedTrip.id !== savedTripId);
    setSavedTrips(nextSavedTrips);

    if (selectedTrip?.id === savedTripId) {
      setSelectedTrip(nextSavedTrips[0] ?? null);
    }
  };

  const shareSavedTrip = async (savedTrip: SavedTrip) => {
    setShareMessage("");
    setErrorMessage("");

    try {
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
          : "分享链接已复制，可以发给朋友查看。",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建分享链接失败");
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
              Saved Trips
            </p>
            <h1 className="mt-2 text-3xl font-black">我的行程</h1>
          </div>
          <p className="text-sm text-white/45">{savedTrips.length} 条已收藏路线</p>
        </div>

        {errorMessage ? (
          <p className="mb-5 rounded-2xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">
            {errorMessage}
          </p>
        ) : null}

        {shareMessage ? (
          <p className="mb-5 rounded-2xl border border-orange-200/20 bg-orange-300/10 px-4 py-3 text-sm font-semibold text-orange-100">
            {shareMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-xl">
            <p className="text-lg font-black">正在读取你的游客行程...</p>
          </div>
        ) : savedTrips.length > 0 ? (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="space-y-4">
              {savedTrips.map((savedTrip) => {
                const isSelected = selectedTrip?.id === savedTrip.id;

                return (
                  <article
                    key={savedTrip.id}
                    className={`rounded-3xl border p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-1 ${
                      isSelected
                        ? "border-orange-300/40 bg-orange-500/15"
                        : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                      {new Date(savedTrip.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    <h2 className="mt-3 text-xl font-black">{savedTrip.title}</h2>
                    <p className="mt-2 text-sm text-white/50">{savedTrip.destination}</p>
                    <p className="mt-4 text-sm font-bold text-orange-200">
                      {savedTrip.plan.budget_per_person}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTrip(savedTrip)}
                        className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 transition-all hover:bg-orange-100"
                      >
                        查看
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTravelPlanHtml(savedTrip.plan)}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/20"
                      >
                        下载行程卡
                      </button>
                      <button
                        type="button"
                        onClick={() => shareSavedTrip(savedTrip)}
                        className="rounded-full bg-orange-400 px-4 py-2 text-xs font-black text-white transition-all hover:bg-orange-300"
                      >
                        分享链接
                      </button>
                      <SocialShareModal
                        tripSummary={savedTrip.plan}
                        buttonClassName="rounded-full bg-gradient-to-r from-orange-400 to-red-400 px-4 py-2 text-xs font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => removeSavedTrip(savedTrip.id)}
                        className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/70 transition-all hover:bg-red-500/30 hover:text-white"
                      >
                        移除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div>
              {selectedTrip ? (
                <PlanDisplay plan={selectedTrip.plan} />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-xl">
                  <p className="text-lg font-black">选择一条行程查看详情</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-xl">
            <p className="text-lg font-black">还没有收藏的行程</p>
            <p className="mt-2 text-sm text-white/45">在首页生成路线后点击“收藏行程”，这里就会保存下来。</p>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
                Agent Trace
              </p>
              <h2 className="mt-2 text-2xl font-black">最近执行记录</h2>
            </div>
            <p className="text-sm text-white/45">{agentTraces.length} 条记录</p>
          </div>

          {agentTraces.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {agentTraces.slice(0, 6).map((trace) => (
                <article
                  key={trace.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black">{trace.instruction}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {new Date(trace.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-black ${
                        trace.status === "success"
                          ? "bg-emerald-300/15 text-emerald-200"
                          : "bg-red-300/15 text-red-100"
                      }`}
                    >
                      {trace.status === "success" ? "SUCCESS" : "FAILED"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {trace.actions.map((action) => (
                      <span
                        key={`${trace.id}-${action.toolName}`}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/60"
                      >
                        {action.label}
                      </span>
                    ))}
                  </div>

                  {trace.weatherSummary ? (
                    <p className="mt-3 text-xs leading-5 text-orange-100/70">
                      天气工具：{trace.weatherSummary}
                    </p>
                  ) : null}

                  {trace.guardrailIssues.length > 0 ? (
                    <p className="mt-3 text-xs leading-5 text-red-100/80">
                      Guardrails：{trace.guardrailIssues.join("；")}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/45">
              还没有 Agent 执行记录。生成路线后，用 AI 行程管家修改一次就会出现在这里。
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
