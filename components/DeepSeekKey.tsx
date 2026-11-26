"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";

const aiEndpoints = {
  generate: "/api/generate",
  refine: "/api/refine-route",
  copy: "/api/generate-copy",
} as const;

const maxKeyLength = 512;
const keyPattern = /^[A-Za-z0-9._~+\/-]+=*$/;
const keyId = "tuda-deepseek-key";
const KeyContext = createContext<{ key: string; setKey: (value: string) => void } | null>(null);

export function DeepSeekKeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState("");
  return <KeyContext.Provider value={{ key, setKey }}>{children}</KeyContext.Provider>;
}

function useDeepSeekKey() {
  const context = useContext(KeyContext);
  if (!context) throw new Error("请从途搭工作区打开 AI 功能。");
  return context;
}

export function useDeepSeekRequest() {
  const { key } = useDeepSeekKey();

  return (operation: keyof typeof aiEndpoints, body: object) => {
    const token = key.trim();
    if (!token) throw new Error("请先在页面上方填写 DeepSeek API Key。");
    if (token.length > maxKeyLength || !keyPattern.test(token)) {
      throw new Error("DeepSeek API Key 格式有误，请重新粘贴完整的 Key。");
    }

    return fetch(aiEndpoints[operation], {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  };
}

export function DeepSeekKeyField() {
  const { key, setKey } = useDeepSeekKey();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="border-b border-white/10 bg-[#090909] px-5 py-3 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label htmlFor={keyId} className="block text-sm font-semibold">DeepSeek API Key</label>
          <p id={`${keyId}-help`} className="mt-0.5 text-xs text-white/65">仅在当前标签页保留，刷新后需重新填写。</p>
        </div>
        <div className="flex min-w-0 gap-2 sm:w-72">
          <input
            ref={input}
            id={keyId}
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            aria-describedby={`${keyId}-help`}
            placeholder="粘贴你的 Key"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={maxKeyLength}
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-orange-300"
          />
          <button
            type="button"
            onClick={() => { setKey(""); input.current?.focus(); }}
            disabled={!key}
            className="shrink-0 rounded-lg px-2.5 text-sm text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-orange-300 disabled:opacity-40"
          >
            清除
          </button>
        </div>
      </div>
    </div>
  );
}
