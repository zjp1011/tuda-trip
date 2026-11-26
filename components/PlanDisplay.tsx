import type { ScheduleItemType, TravelPlan } from "../types/travel";

interface PlanDisplayProps {
  plan?: TravelPlan;
}

const typeStyles: Record<
  ScheduleItemType,
  {
    label: string;
    icon: string;
    accent: string;
  }
> = {
  spot: {
    label: "景点",
    icon: "景",
    accent: "border-[#356560] bg-[#152f33] text-[#9bf3dd]",
  },
  food: {
    label: "美食",
    icon: "食",
    accent: "border-[#654e40] bg-[#342b26] text-[#f4cfaa]",
  },
  transit: {
    label: "交通",
    icon: "行",
    accent: "border-[#3b5877] bg-[#192b40] text-[#b5d9ff]",
  },
  rest: {
    label: "休整",
    icon: "歇",
    accent: "border-[#4b5760] bg-[#29323a] text-[#d5e0e7]",
  },
};

export const mockTravelPlan: TravelPlan = {
  plan_id: "plan_1",
  plan_title: "成都慢游一日",
  highlights: ["宽窄巷子慢逛拍照", "夜市小吃连吃路线", "本地火锅和盖碗茶体验"],
  budget_per_person: "200–400 元",
  pace_rating: 4,
  days: [
    {
      day_number: 1,
      day_theme: "老街烟火与盖碗茶文化",
      schedule: [
        {
          time_bucket: "上午",
          type: "spot",
          location: "宽窄巷子",
          activity: "慢逛青砖巷院，拍摄成都老街氛围照。",
          duration: "2小时",
          tips: "建议早点到，人少更好拍。",
        },
        {
          time_bucket: "中午",
          type: "food",
          location: "奎星楼街",
          activity: "按地道小吃路线吃串串、蛋烘糕、冰粉和糖油果子。",
          duration: "1.5小时",
          tips: "适合少量多家，能吃辣再加红油，不吃辣可选甜口小吃。",
        },
        {
          time_bucket: "下午",
          type: "rest",
          location: "人民公园鹤鸣茶社",
          activity: "喝盖碗茶，体验成都人的下午节奏。",
          duration: "2小时",
          tips: "点一杯花茶，适合聊天放空。",
        },
      ],
      accommodation: {
        area_recommendation: "春熙路商圈",
        reason: "交通便利，去热门街区和夜宵点都比较顺路。",
      },
    },
  ],
};

export default function PlanDisplay({ plan = mockTravelPlan }: PlanDisplayProps) {
  return (
    <section className="tuda-panel mx-auto w-full max-w-[var(--tuda-content-width)] overflow-hidden text-[var(--tuda-text)]">
      <header className="border-b border-[var(--tuda-line)] bg-[#122332] p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.43fr)] sm:items-end">
          <div>
            <p className="tuda-kicker">行程概览</p>
            <h2 className="mt-3 max-w-3xl text-2xl leading-tight font-bold tracking-tight break-words sm:text-4xl">
              {plan.plan_title}
            </h2>
          </div>

          <div className="rounded-xl border border-[var(--tuda-line)] bg-[#0d1b27] p-4">
            <p className="text-xs text-[var(--tuda-muted)]">人均预算参考</p>
            <p className="mt-1 text-xl font-bold text-[var(--tuda-accent)]">{plan.budget_per_person}</p>
            <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-[#263b4a]">
              <div
                className="h-full rounded-full bg-[var(--tuda-accent)]"
                style={{ width: `${Math.min(100, Math.max(20, plan.pace_rating * 20))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--tuda-muted)]">节奏评分 {plan.pace_rating}/5</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {plan.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-[var(--tuda-line)] bg-[#152938] px-3 py-1.5 text-xs text-[#cddde1]"
            >
              {highlight}
            </span>
          ))}
        </div>
      </header>

      <div className="divide-y divide-[var(--tuda-line)]">
        {plan.days.map((day) => (
          <article
            key={day.day_number}
            className="p-5 sm:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="tuda-kicker">
                  第 {day.day_number} 天
                </span>
                <h3 className="mt-2 text-xl font-bold sm:text-2xl">{day.day_theme}</h3>
                <p className="mt-2 text-sm text-[var(--tuda-muted)]">{day.schedule.length} 个停靠点</p>
              </div>

              <div className="rounded-xl border border-[var(--tuda-line)] bg-[#0c1723] px-4 py-3 sm:max-w-xs">
                <p className="text-xs text-[var(--tuda-muted)]">住宿区域参考</p>
                <p className="mt-1 text-sm font-semibold">{day.accommodation.area_recommendation}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--tuda-muted)]">{day.accommodation.reason}</p>
              </div>
            </div>

            <ol className="mt-6 grid gap-3">
              {day.schedule.map((item, index) => {
                const style = typeStyles[item.type];

                return (
                  <li
                    key={`${day.day_number}-${item.time_bucket}-${index}`}
                    className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 sm:gap-4"
                  >
                    {index < day.schedule.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-8 left-4 h-[calc(100%-1.25rem)] w-px bg-[#304553]"
                      />
                    ) : null}

                    <span
                      aria-hidden="true"
                      className={`relative grid size-8 place-items-center rounded-lg border text-xs font-bold ${style.accent}`}
                    >
                      {style.icon}
                    </span>

                    <div className="min-w-0 rounded-xl border border-[var(--tuda-line)] bg-[#0c1723] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#d2e0e7]">
                          {item.time_bucket}
                        </span>
                        <span className={`rounded-md border px-1.5 py-0.5 text-xs ${style.accent}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-[var(--tuda-muted)]">{item.duration}</span>
                      </div>

                      <h4 className="mt-3 text-lg leading-tight font-semibold break-words">{item.location}</h4>
                      <p className="mt-2 text-sm leading-6 text-[#c8d7df]">{item.activity}</p>
                      <p className="mt-2 text-xs leading-5 text-[var(--tuda-muted)]">{item.tips}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
