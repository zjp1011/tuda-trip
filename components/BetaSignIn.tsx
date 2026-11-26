"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function BetaSignIn({ available }: { available: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(typeof result?.error === "string" ? result.error : "暂时无法进入内测。");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("连接失败，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="tuda-signin">
      <div className="tuda-signin-inner">
        <div>
          <div className="tuda-brand">
            <span className="tuda-mark" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">途搭</span>
          </div>
          <p className="tuda-signin-heading">用 AI 规划<br />下一程。</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#c0d0da] sm:text-base">
            从目的地到每天的安排，把路线规划、天气参考和行程修改放在一个工作区。
          </p>
        </div>
        <section className="tuda-panel tuda-signin-card" aria-labelledby="beta-heading">
          <h1 id="beta-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">途搭内测</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--tuda-muted)]">
            {available ? "输入内测口令后进入行程工作区。" : "内测入口正在准备中。"}
          </p>
          {available && (
            <form onSubmit={signIn} aria-busy={pending} className="mt-7 space-y-3">
              <label htmlFor="beta-password" className="block text-sm font-semibold">内测口令</label>
              <input
                id="beta-password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "beta-error" : undefined}
                className="tuda-input w-full"
              />
              {error && <p id="beta-error" role="alert" className="text-sm text-[#ffb9a8]">{error}</p>}
              <button type="submit" disabled={pending} className="tuda-button-primary w-full">
                {pending ? "验证中…" : "进入途搭"}
              </button>
            </form>
          )}
          <a href="https://yayapeng.xyz/" className="mt-6 inline-block text-sm text-[var(--tuda-muted)] hover:text-[var(--tuda-accent)]">
            返回 Yayapeng Lab
          </a>
        </section>
      </div>
    </main>
  );
}
