"use client";

import { useEffect, useState } from "react";
import PlanDisplay from "@/components/PlanDisplay";
import SocialShareModal from "@/components/SocialShareModal";
import { useUser } from "@/hooks/useUser";
import { downloadTravelPlanHtml } from "@/lib/exportTravelPlan";
import type { AgentTrace } from "@/lib/serverAgentTrace";
import { buildShareUrl, isLocalShareUrl } from "@/lib/shareUrl";
import {
  LEGACY_SAVED_TRIPS_STORAGE_KEY,
  SAVED_TRIPS_STORAGE_KEY,
  type SavedTrip,
} from "@/lib/savedTrips";
import { isRenderableTravelPlan } from "@/lib/travelPlanGuardrails";

const legacyStorageKeys = [SAVED_TRIPS_STORAGE_KEY, LEGACY_SAVED_TRIPS_STORAGE_KEY];

function readLegacySavedTrips(key: string): unknown[] | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return [];
    const entries: unknown = JSON.parse(stored);
    return Array.isArray(entries) ? entries : null;
  } catch {
    return null;
  }
}

function readLegacyTrip(value: unknown): Pick<SavedTrip, "destination" | "plan"> | null {
  if (!value || typeof value !== "object" || !("plan" in value) || !isRenderableTravelPlan(value.plan)) {
    return null;
  }
  const destination = "destination" in value && typeof value.destination === "string"
    ? value.destination
    : "未命名目的地";
  return { destination, plan: value.plan };
}

async function migrateLegacySavedTrips(guestId: string) {
  const pending = new Map<string, Pick<SavedTrip, "destination" | "plan">>();
  for (const key of legacyStorageKeys) {
    for (const entry of readLegacySavedTrips(key) ?? []) {
      const trip = readLegacyTrip(entry);
      if (!trip) continue;
      const signature = JSON.stringify(trip.plan);
      if (!pending.has(signature)) pending.set(signature, trip);
    }
  }

  const saved = new Set<string>();
  for (const [signature, trip] of pending) {
    try {
      const response = await fetch("/api/save-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: guestId, ...trip }),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { savedTrip?: SavedTrip } | null;
      if (JSON.stringify(data?.savedTrip?.plan) === signature) saved.add(signature);
    } catch {
      // Keep this entry so a later visit to the diary can retry it.
    }
  }

  let remaining = false;
  for (const key of legacyStorageKeys) {
    const entries = readLegacySavedTrips(key);
    if (!entries) {
      remaining = true;
      continue;
    }
    const unsaved = entries.filter((entry) => {
      const trip = readLegacyTrip(entry);
      return !trip || !saved.has(JSON.stringify(trip.plan));
    });
    remaining ||= unsaved.length > 0;
    if (unsaved.length === entries.length) continue;
    try {
      if (unsaved.length) window.localStorage.setItem(key, JSON.stringify(unsaved));
      else window.localStorage.removeItem(key);
    } catch {
      remaining = true;
    }
  }
  return remaining;
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
        const hasLocalTripsToRetry = await migrateLegacySavedTrips(guestId);

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
        if (hasLocalTripsToRetry) {
          setErrorMessage("还有旧收藏待同步，本地记录已保留。重新打开行程日记可重试。");
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
    <div className="tuda-subpage">
      <div>
        <header className="tuda-subpage-heading mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1>我的行程</h1>
          <p className="text-sm text-[var(--tuda-muted)]">{savedTrips.length} 条已收藏路线</p>
        </header>

        {errorMessage ? (
          <p className="mb-5 rounded-2xl border border-red-300/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">
            {errorMessage}
          </p>
        ) : null}

        {shareMessage ? (
          <p className="tuda-panel mb-5 px-4 py-3 text-sm text-[var(--tuda-accent)]">
            {shareMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="tuda-panel p-8 text-center">
            <p className="text-lg font-semibold">正在读取你的收藏…</p>
          </div>
        ) : savedTrips.length > 0 ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(17rem,0.45fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {savedTrips.map((savedTrip) => {
                const isSelected = selectedTrip?.id === savedTrip.id;

                return (
                  <article
                    key={savedTrip.id}
                    className={`rounded-2xl border p-5 ${
                      isSelected
                        ? "border-[#406e72] bg-[#132832]"
                        : "border-[var(--tuda-line)] bg-[var(--tuda-panel)]"
                    }`}
                  >
                    <p className="text-xs font-medium text-[var(--tuda-muted)]">
                      {new Date(savedTrip.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    <h2 className="mt-3 text-lg font-bold break-words">{savedTrip.title}</h2>
                    <p className="mt-2 text-sm text-[var(--tuda-muted)]">
                      {savedTrip.destination}
                      {savedTrip.departureDate ? ` · ${savedTrip.departureDate} 出发` : null}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[var(--tuda-accent)]">
                      {savedTrip.plan.budget_per_person}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTrip(savedTrip)}
                        className="tuda-button-primary"
                      >
                        查看
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTravelPlanHtml(savedTrip.plan)}
                        className="tuda-button-secondary"
                      >
                        下载行程卡
                      </button>
                      <button
                        type="button"
                        onClick={() => shareSavedTrip(savedTrip)}
                        className="tuda-button-secondary"
                      >
                        分享链接
                      </button>
                      <SocialShareModal
                        tripSummary={savedTrip.plan}
                        buttonClassName="tuda-button-secondary"
                      />
                      <button
                        type="button"
                        onClick={() => removeSavedTrip(savedTrip.id)}
                        className="tuda-button-secondary text-[#ffc3b7] hover:text-[#ffe1da]"
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
                <div className="tuda-panel p-8 text-center">
                  <p className="text-lg font-semibold">选择一条行程查看详情</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="tuda-panel p-8 text-center">
            <p className="text-lg font-semibold">还没有收藏的行程</p>
            <p className="mt-2 text-sm text-[var(--tuda-muted)]">在首页生成路线后，点击「收藏行程」。</p>
          </div>
        )}

        <section className="tuda-panel mt-8 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-bold">最近执行记录</h2>
            <p className="text-sm text-[var(--tuda-muted)]">{agentTraces.length} 条记录</p>
          </div>

          {agentTraces.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {agentTraces.slice(0, 6).map((trace) => (
                <article
                  key={trace.id}
                  className="rounded-xl border border-[var(--tuda-line)] bg-[#0c1723] p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black">{trace.instruction}</p>
                      <p className="mt-1 text-xs text-[var(--tuda-muted)]">
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
                      {trace.status === "success" ? "已完成" : "失败"}
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
                    <p className="mt-3 text-xs leading-5 text-[var(--tuda-muted)]">
                      天气参考 {trace.weatherSummary}
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
