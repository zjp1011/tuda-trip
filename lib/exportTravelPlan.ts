import type { ScheduleItemType, TravelPlan } from "../types/travel";

const typeLabels: Record<ScheduleItemType, string> = {
  spot: "景点",
  food: "美食",
  transit: "交通",
  rest: "休整",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "travel-plan";
}

function buildTravelPlanHtml(plan: TravelPlan) {
  const highlights = plan.highlights
    .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
    .join("");

  const days = plan.days
    .map((day) => {
      const schedule = day.schedule
        .map(
          (item) => `
            <article class="schedule-item ${item.type}">
              <div class="schedule-time">${escapeHtml(item.time_bucket)}</div>
              <div class="schedule-content">
                <div class="schedule-meta">
                  <span>${typeLabels[item.type]}</span>
                  <span>${escapeHtml(item.duration)}</span>
                </div>
                <h3>${escapeHtml(item.location)}</h3>
                <p>${escapeHtml(item.activity)}</p>
                <p class="tips">${escapeHtml(item.tips)}</p>
              </div>
            </article>
          `,
        )
        .join("");

      return `
        <section class="day-card">
          <div class="day-header">
            <span>Day ${day.day_number}</span>
            <h2>${escapeHtml(day.day_theme)}</h2>
          </div>
          <div class="schedule-list">${schedule}</div>
          <div class="hotel">
            <strong>推荐入住：${escapeHtml(day.accommodation.area_recommendation)}</strong>
            <p>${escapeHtml(day.accommodation.reason)}</p>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(plan.plan_title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
    }
    main {
      width: min(920px, calc(100% - 32px));
      margin: 0 auto;
      padding: 40px 0;
    }
    .hero {
      border-radius: 32px;
      padding: 32px;
      color: white;
      background: linear-gradient(135deg, #fb923c, #ef4444 55%, #111827);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
    }
    .eyebrow {
      margin: 0 0 10px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(30px, 5vw, 52px);
      line-height: 1.12;
      letter-spacing: 0;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 22px;
    }
    .pill {
      border-radius: 999px;
      padding: 9px 14px;
      background: rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 800;
    }
    .section-title {
      margin: 34px 0 14px;
      font-size: 22px;
      font-weight: 900;
    }
    .highlights {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .highlights li {
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 14px 16px;
      background: white;
      font-weight: 700;
    }
    .day-card {
      margin-top: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 28px;
      padding: 24px;
      background: white;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    .day-header span {
      color: #f97316;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .day-header h2 {
      margin: 4px 0 18px;
      font-size: 24px;
      line-height: 1.3;
    }
    .schedule-list {
      display: grid;
      gap: 12px;
    }
    .schedule-item {
      display: grid;
      grid-template-columns: 76px 1fr;
      gap: 14px;
      border-radius: 22px;
      padding: 16px;
      background: #f8fafc;
    }
    .schedule-time {
      color: #475569;
      font-size: 14px;
      font-weight: 900;
    }
    .schedule-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 6px;
    }
    .schedule-meta span {
      border-radius: 999px;
      padding: 4px 9px;
      background: #e2e8f0;
      color: #334155;
      font-size: 12px;
      font-weight: 800;
    }
    .food .schedule-meta span:first-child { background: #ffedd5; color: #c2410c; }
    .spot .schedule-meta span:first-child { background: #ccfbf1; color: #0f766e; }
    .rest .schedule-meta span:first-child { background: #ede9fe; color: #6d28d9; }
    .transit .schedule-meta span:first-child { background: #dbeafe; color: #1d4ed8; }
    .schedule-content h3 {
      margin: 0;
      font-size: 18px;
    }
    .schedule-content p {
      margin: 6px 0 0;
      color: #475569;
    }
    .tips {
      color: #9a3412 !important;
      font-weight: 700;
    }
    .hotel {
      margin-top: 16px;
      border-radius: 22px;
      padding: 16px;
      background: #fff7ed;
      color: #9a3412;
    }
    .hotel p {
      margin: 4px 0 0;
    }
    @media print {
      body { background: white; }
      main { width: 100%; padding: 0; }
      .hero, .day-card { box-shadow: none; }
      .day-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">Tuda Travel Plan</p>
      <h1>${escapeHtml(plan.plan_title)}</h1>
      <div class="summary">
        <span class="pill">人均预算：${escapeHtml(plan.budget_per_person)}</span>
        <span class="pill">节奏评分：${plan.pace_rating}/5</span>
        <span class="pill">${plan.days.length} 天行程</span>
      </div>
    </section>

    <h2 class="section-title">行程亮点</h2>
    <ul class="highlights">${highlights}</ul>

    <h2 class="section-title">每日安排</h2>
    ${days}
  </main>
</body>
</html>`;
}

export function downloadTravelPlanHtml(plan: TravelPlan) {
  const fileContent = buildTravelPlanHtml(plan);
  const blob = new Blob([fileContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeFileName(plan.plan_title)}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
