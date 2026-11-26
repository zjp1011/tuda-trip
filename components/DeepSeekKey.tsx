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
    <div className="tuda-credential">
      <div className="tuda-credential-inner">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={keyId} className="text-sm font-semibold">DeepSeek API Key</label>
            {key.trim() && (
              <span className="text-xs font-medium text-[var(--tuda-accent)]">已填入</span>
            )}
          </div>
          <p id={`${keyId}-help`} className="mt-0.5 text-xs leading-5 text-[var(--tuda-muted)]">
            仅保留在当前标签页，刷新后需重新填写。
          </p>
        </div>
        <div className="tuda-credential-field">
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
            className="tuda-input"
          />
          <button
            type="button"
            onClick={() => { setKey(""); input.current?.focus(); }}
            disabled={!key}
            className="tuda-button-secondary shrink-0"
          >
            清除
          </button>
        </div>
      </div>
    </div>
  );
}
