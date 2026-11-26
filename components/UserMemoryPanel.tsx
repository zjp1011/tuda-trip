"use client";

import { useEffect, useState } from "react";
import { defaultUserMemory, type UserMemory } from "../lib/userMemory";

type UserMemoryPanelProps = {
  guestId: string;
  onMemoryChanged: (memory: UserMemory) => void;
};

const memoryChips = [
  "不吃辣",
  "不早起",
  "喜欢松弛节奏",
  "偏爱本地小吃",
  "喜欢咖啡店",
  "喜欢夜景",
  "预算控制在人均1200元",
  "少走路",
];

export default function UserMemoryPanel({ guestId, onMemoryChanged }: UserMemoryPanelProps) {
  const [memory, setMemory] = useState<UserMemory>(defaultUserMemory);
  const [customPreference, setCustomPreference] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    if (!guestId) {
      return;
    }

    const loadMemory = async () => {
      try {
        const response = await fetch(`/api/user-memory?userId=${encodeURIComponent(guestId)}`);
        const data = (await response.json()) as { memory?: UserMemory; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "读取偏好记忆失败");
        }

        const nextMemory = data.memory ?? defaultUserMemory;
        setMemory(nextMemory);
        onMemoryChanged(nextMemory);
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : "读取偏好记忆失败");
      }
    };

    void loadMemory();
  }, [guestId, onMemoryChanged]);

  const saveMemory = async (preferences: string[]) => {
    if (!guestId) {
      setStatusText("游客身份初始化中，请稍后再保存偏好。");
      return;
    }

    setIsSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/user-memory", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: guestId,
          preferences,
        }),
      });
      const data = (await response.json()) as { memory?: UserMemory; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "保存偏好记忆失败");
      }

      const nextMemory = data.memory ?? defaultUserMemory;
      setMemory(nextMemory);
      onMemoryChanged(nextMemory);
      setStatusText("偏好记忆已更新，下次生成会自动带入。");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "保存偏好记忆失败");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (preference: string) => {
    const nextPreferences = memory.preferences.includes(preference)
      ? memory.preferences.filter((item) => item !== preference)
      : [...memory.preferences, preference];

    void saveMemory(nextPreferences);
  };

  const addCustomPreference = () => {
    const trimmedPreference = customPreference.trim();

    if (!trimmedPreference || memory.preferences.includes(trimmedPreference)) {
      setCustomPreference("");
      return;
    }

    setCustomPreference("");
    void saveMemory([...memory.preferences, trimmedPreference]);
  };

  const clearMemory = () => {
    void saveMemory([]);
  };

  return (
    <section className="px-5 pb-8 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/15 bg-black/40 p-5 text-left text-white shadow-2xl shadow-black/20 backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
              Memory
            </p>
            <h2 className="mt-2 text-2xl font-black">长期偏好记忆</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              这些偏好会绑定到当前游客身份，生成路线和 AI 行程管家修改时都会自动参考。
            </p>
          </div>
          <button
            type="button"
            onClick={clearMemory}
            disabled={isSaving || memory.preferences.length === 0}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white/70 transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空记忆
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {memoryChips.map((chip) => {
            const isSelected = memory.preferences.includes(chip);

            return (
              <button
                key={chip}
                type="button"
                onClick={() => togglePreference(chip)}
                disabled={isSaving}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/25"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={customPreference}
            onChange={(event) => setCustomPreference(event.target.value)}
            placeholder="添加自定义记忆，例如：喜欢博物馆、不坐缆车"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-teal-300/50"
          />
          <button
            type="button"
            onClick={addCustomPreference}
            disabled={isSaving || !customPreference.trim()}
            className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            记住
          </button>
        </div>

        {statusText ? (
          <p className="mt-3 text-xs font-semibold text-teal-100/75">{statusText}</p>
        ) : null}
      </div>
    </section>
  );
}
