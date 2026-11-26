"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useDeepSeekRequest } from "@/components/DeepSeekKey";
import ItineraryAgentPanel from "@/components/ItineraryAgentPanel";
import PlanDisplay from "@/components/PlanDisplay";
import SocialShareModal from "@/components/SocialShareModal";
import UserMemoryPanel from "@/components/UserMemoryPanel";
import WeatherInsightCard from "@/components/WeatherInsightCard";
import { useUser } from "@/hooks/useUser";
import { downloadTravelPlanHtml } from "@/lib/exportTravelPlan";
import {
  readItineraryDraft, writeItineraryDraft,
  type ItineraryContext, type ItineraryDraft, type ItinerarySnapshot,
} from "@/lib/itineraryDraft";
import type { SavedTrip } from "@/lib/savedTrips";
import { buildShareUrl, isLocalShareUrl } from "@/lib/shareUrl";
import { defaultUserMemory, type UserMemory } from "@/lib/userMemory";
import type { TravelPlan, TravelPlansResponse } from "@/types/travel";
import styles from "./page.module.css";

const companions = ["单人", "情侣", "亲子", "朋友"] as const;
const budgets = [
  { value: "经济实惠", label: "500 元以内" },
  { value: "舒适预算", label: "500–1500 元" },
  { value: "品质享受", label: "1500–3000 元" },
  { value: "不设上限", label: "3000 元以上" },
] as const;
const travelOptions = ["历史文化", "自然风光", "特色街区", "美食探索", "松弛度假", "亲子友好"];
const foodOptions = ["地道小吃", "网红餐厅", "夜市探店", "特色火锅", "甜品咖啡", "本地老店"];
const destinations = [
  { city: "成都", detail: "茶馆与街巷慢生活" },
  { city: "厦门", detail: "海风与岛屿日落" },
  { city: "大理", detail: "山海之间的轻度假" },
  { city: "上海", detail: "展览、街区与夜景" },
];

const initialDraft: ItineraryDraft = {
  form: {
    destination: "", days: "3", departureDate: "", companion: "朋友",
    budgetPreference: "舒适预算", customBudget: "", travelStyles: ["自然风光"],
    foodPreferences: [], customFoodPreference: "",
  },
  current: null,
  previous: null,
};

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(typeof data?.error === "string" ? data.error : fallback);
  }
  return data as T;
}

export default function Home() {
  const router = useRouter();
  const requestDeepSeek = useDeepSeekRequest();
  const { guestId } = useUser();
  const [draft, setDraft] = useState(initialDraft);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [userMemory, setUserMemory] = useState<UserMemory>(defaultUserMemory);
  const [generation, setGeneration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultAction, setResultAction] = useState<"save" | "share" | null>(null);
  const [resultFeedback, setResultFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [shareLink, setShareLink] = useState("");
  const { form, current, previous } = draft;
  const submittedPreferencesDiffer = Boolean(current && (
    current.context.destination !== form.destination.trim() ||
    current.context.days !== Number(form.days) ||
    current.context.departureDate !== form.departureDate
  ));

  useEffect(() => {
    const restored = readItineraryDraft() ?? initialDraft;
    const city = new URLSearchParams(window.location.search).get("city")?.trim().slice(0, 100);
    setDraft(city ? { ...restored, form: { ...restored.form, destination: city } } : restored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) setStorageAvailable(writeItineraryDraft(draft));
  }, [ready, draft]);

  useEffect(() => {
    if (generation === 0) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    document.getElementById("generated-plan")?.scrollIntoView({ behavior: motion, block: "start" });
  }, [generation]);

  function updateForm<K extends keyof ItineraryDraft["form"]>(key: K, value: ItineraryDraft["form"][K]) {
    setDraft((state) => ({ ...state, form: { ...state.form, [key]: value } }));
  }

  function selectDestination(city: string) {
    updateForm("destination", city);
    document.getElementById("trip-destination")?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) return;
    const context: ItineraryContext = {
      destination: form.destination.trim(), days: Number(form.days), departureDate: form.departureDate,
    };
    if (!context.destination) {
      setErrorMessage("请填写旅行目的地。");
      return;
    }
    setErrorMessage("");
    setIsGenerating(true);

    try {
      const response = await requestDeepSeek("generate", {
        ...form, ...context, userId: guestId, userMemoryPreferences: userMemory.preferences,
      });
      const data = await readResponse<TravelPlansResponse>(response, "暂时无法生成行程，请稍后重试。");
      const plan = data.plans?.[0];
      if (!plan?.days || plan.days.length !== context.days) {
        throw new Error("生成的行程天数与所选天数不符，请重试。");
      }
      setDraft((state) => ({ ...state, current: { context, plan }, previous: null }));
      setResultFeedback(null);
      setShareLink("");
      setGeneration((value) => value + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "暂时无法生成行程。");
    } finally {
      setIsGenerating(false);
    }
  }

  function updatePlanFromAgent(source: ItinerarySnapshot, plan: TravelPlan) {
    setDraft((state) => {
      if (state.current !== source) return state;
      return { ...state, current: { context: source.context, plan }, previous: source };
    });
    setResultFeedback(null);
    setShareLink("");
  }

  function undoLastEdit() {
    setDraft((state) => state.previous
      ? { ...state, current: state.previous, previous: null }
      : state);
    setResultFeedback({ text: "已恢复上一次修改前的行程。" });
    setShareLink("");
    setGeneration((value) => value + 1);
  }

  async function savePlan(snapshot: ItinerarySnapshot) {
    if (!guestId) {
      setResultFeedback({ text: "正在初始化访客身份，请稍后再收藏。", error: true });
      return;
    }
    setResultAction("save");
    setResultFeedback(null);
    try {
      const response = await fetch("/api/save-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: guestId, destination: snapshot.context.destination,
          departureDate: snapshot.context.departureDate, plan: snapshot.plan,
        }),
      });
      await readResponse(response, "收藏行程失败，请重试。");
      router.push("/diary");
    } catch (error) {
      setResultFeedback({ text: error instanceof Error ? error.message : "收藏行程失败，请重试。", error: true });
    } finally {
      setResultAction(null);
    }
  }

  async function sharePlan(snapshot: ItinerarySnapshot) {
    setResultAction("share");
    setResultFeedback(null);
    try {
      const savedTrip: SavedTrip = {
        id: crypto.randomUUID(), title: snapshot.plan.plan_title, destination: snapshot.context.destination,
        ...(snapshot.context.departureDate ? { departureDate: snapshot.context.departureDate } : {}),
        createdAt: new Date().toISOString(), plan: snapshot.plan,
      };
      const response = await fetch("/api/share-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedTrip }),
      });
      const data = await readResponse<{ sharedRoute?: { id: string } }>(response, "暂时无法创建分享链接。");
      if (!data.sharedRoute?.id) throw new Error("暂时无法创建分享链接。");
      const link = buildShareUrl(data.sharedRoute.id);
      setShareLink(link);
      if (isLocalShareUrl(link)) {
        setResultFeedback({ text: "已创建本机分享链接，可在部署后分享公网版本。" });
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        setResultFeedback({ text: "已复制分享地址，持有链接的朋友可以查看。" });
      } catch {
        setResultFeedback({ text: "分享链接已生成，可从输入框手动复制。" });
      }
    } catch (error) {
      setResultFeedback({ text: error instanceof Error ? error.message : "暂时无法创建分享链接。", error: true });
    } finally {
      setResultAction(null);
    }
  }

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="trip-title">
        <div className={styles.heroContent}>
          <p className="tuda-kicker">途搭 / AI 旅行规划</p>
          <h1 id="trip-title">你的下一站，<br /><span>从这里出发。</span></h1>
          <p className={styles.heroLead}>把目的地、日期和偏好交给途搭，安排一份适合你们的每日路线。</p>
          {current ? <a href="#generated-plan" className={styles.continueLink}>继续查看行程 <span aria-hidden="true">↘</span></a> : null}
        </div>
      </section>

      <div className={styles.content}>
        <form className={styles.planner} onSubmit={handleSubmit} aria-busy={isGenerating}>
          <div className={styles.plannerHeading}>
            <div>
              <h2>规划行程</h2>
              <p>选好去哪、哪天出发，再按你的预算和节奏细调。</p>
            </div>
            {ready && (form.destination || current) ? (
              <span className={styles.draftStatus}>{storageAvailable ? "草稿保存在本机" : "本机草稿暂时无法保存"}</span>
            ) : null}
          </div>

          <div className={styles.primaryFields}>
            <label className={styles.field}>
              <span>目的地</span>
              <input id="trip-destination" className="tuda-input" value={form.destination}
                onChange={(event) => updateForm("destination", event.target.value)}
                placeholder="想去哪里？例如 成都" maxLength={100} required />
            </label>
            <label className={styles.field}>
              <span>出发日期 <small>选填</small></span>
              <input aria-label="出发日期" type="date" className="tuda-input" value={form.departureDate}
                onChange={(event) => updateForm("departureDate", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>游玩天数</span>
              <select value={form.days} className="tuda-input" onChange={(event) => updateForm("days", event.target.value)}>
                {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day} 天</option>)}
              </select>
            </label>
            <button className={"tuda-button-primary " + styles.generate} type="submit" disabled={!ready || isGenerating}>
              {isGenerating ? "正在规划…" : "生成行程"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          {errorMessage ? <p role="alert" className={styles.error}>{errorMessage}</p> : null}

          <div className={styles.quickDestinations}>
            <span>热门目的地</span>
            {destinations.map(({ city, detail }) => (
              <button type="button" key={city} title={detail} aria-pressed={form.destination.trim() === city}
                className={styles.chip} onClick={() => selectDestination(city)}>{city}</button>
            ))}
          </div>

          <details className={styles.preferences}>
            <summary>同行、预算与偏好</summary>
            <div className={styles.preferenceGrid}>
              <fieldset>
                <legend>同行人员</legend>
                <div className={styles.chips}>
                  {companions.map((companion) => (
                    <button type="button" key={companion} aria-pressed={form.companion === companion} className={styles.chip}
                      onClick={() => updateForm("companion", companion)}>{companion}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>人均预算</legend>
                <div className={styles.chips}>
                  {budgets.map(({ value, label }) => (
                    <button type="button" key={value} aria-pressed={form.budgetPreference === value && !form.customBudget}
                      className={styles.chip} onClick={() => setDraft((state) => ({
                        ...state, form: { ...state.form, budgetPreference: value, customBudget: "" },
                      }))}>{label}</button>
                  ))}
                </div>
                <input aria-label="自定义人均预算（元）" inputMode="numeric" value={form.customBudget} maxLength={12}
                  onChange={(event) => updateForm("customBudget", event.target.value.replace(/\D/g, ""))}
                  placeholder="自定义金额（元/人）" className="tuda-input" />
              </fieldset>
              <fieldset>
                <legend>旅行风格 <small>{form.travelStyles.length}/3</small></legend>
                <div className={styles.chips}>
                  {travelOptions.map((item) => {
                    const selected = form.travelStyles.includes(item);
                    return <button type="button" key={item} className={styles.chip} aria-pressed={selected}
                      disabled={!selected && form.travelStyles.length >= 3}
                      onClick={() => updateForm("travelStyles", selected
                        ? form.travelStyles.filter((value) => value !== item)
                        : [...form.travelStyles, item])}>{item}</button>;
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend>美食与口味</legend>
                <div className={styles.chips}>
                  {foodOptions.map((item) => {
                    const selected = form.foodPreferences.includes(item);
                    return <button type="button" key={item} className={styles.chip} aria-pressed={selected}
                      onClick={() => updateForm("foodPreferences", selected
                        ? form.foodPreferences.filter((value) => value !== item)
                        : [...form.foodPreferences, item])}>{item}</button>;
                  })}
                </div>
                <input aria-label="自定义口味" value={form.customFoodPreference} maxLength={120}
                  onChange={(event) => updateForm("customFoodPreference", event.target.value)}
                  placeholder="例如：不吃辣、想吃清淡" className="tuda-input" />
              </fieldset>
            </div>
          </details>
        </form>

        {current ? (
          <section id="generated-plan" aria-labelledby="current-trip-heading" className={styles.result}>
            <div className={styles.resultHeader}>
              <div>
                <p className="tuda-kicker">行程工作台</p>
                <h2 id="current-trip-heading">{current.context.destination} · {current.context.days} 天</h2>
                <p>{current.context.departureDate ? current.context.departureDate + " 出发" : "出发日期待定"}</p>
              </div>
              <div className={styles.resultActions}>
                {previous ? <button type="button" className="tuda-button-secondary" onClick={undoLastEdit}>撤销上次修改</button> : null}
                <button type="button" className="tuda-button-secondary" disabled={Boolean(resultAction)}
                  onClick={() => void sharePlan(current)}>{resultAction === "share" ? "正在生成链接…" : "分享链接"}</button>
                <button type="button" className="tuda-button-secondary"
                  onClick={() => downloadTravelPlanHtml(current.plan)}>下载行程卡</button>
                <button type="button" className="tuda-button-primary" disabled={Boolean(resultAction)}
                  onClick={() => void savePlan(current)}>{resultAction === "save" ? "收藏中…" : "收藏行程"}</button>
              </div>
            </div>
            {submittedPreferencesDiffer ? <p className={styles.notice}>上方规划条件已修改，可点击「生成行程」更新结果。</p> : null}
            {resultFeedback ? (
              <p role={resultFeedback.error ? "alert" : "status"} className={resultFeedback.error ? styles.error : styles.notice}>{resultFeedback.text}</p>
            ) : null}
            {shareLink ? <label className={styles.shareField}>
              <span>分享地址</span>
              <input className="tuda-input" readOnly value={shareLink} onFocus={(event) => event.target.select()} />
            </label> : null}
            <WeatherInsightCard {...current.context} />
            <PlanDisplay plan={current.plan} />
            <ItineraryAgentPanel
              key={generation}
              userId={guestId}
              plan={current.plan}
              destination={current.context.destination}
              departureDate={current.context.departureDate}
              memoryPreferences={userMemory.preferences}
              onPlanUpdated={(plan) => updatePlanFromAgent(current, plan)}
            />
            <div className={styles.socialTools}><SocialShareModal tripSummary={current.plan} /></div>
          </section>
        ) : null}

        <details className={styles.memory}>
          <summary>我的旅行偏好</summary>
          <UserMemoryPanel guestId={guestId} onMemoryChanged={setUserMemory} />
        </details>
      </div>
    </div>
  );
}
