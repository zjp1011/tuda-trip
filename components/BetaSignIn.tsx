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
    <main className="flex min-h-dvh items-center justify-center bg-[#070707] px-5 py-12 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-9">
        <h1 className="text-3xl font-black tracking-tight">途搭内测</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          {available ? "输入内测口令，开始规划你的旅行。" : "内测入口正在准备中。"}
        </p>
        {available && (
          <form onSubmit={signIn} className="mt-7 space-y-3">
            <label htmlFor="beta-password" className="block text-sm font-semibold">内测口令</label>
            <input
              id="beta-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 outline-none focus:border-orange-300"
            />
            {error && <p role="alert" className="text-sm text-orange-200">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-orange-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-orange-200 disabled:opacity-60"
            >
              {pending ? "验证中…" : "进入途搭"}
            </button>
          </form>
        )}
        <a href="https://yayapeng.xyz/" className="mt-6 inline-block text-sm text-white/60 hover:text-white">
          返回 Yayapeng Lab
        </a>
      </div>
    </main>
  );
}
