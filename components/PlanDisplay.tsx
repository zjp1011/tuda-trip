import type { ScheduleItemType, TravelPlan } from "../types/travel";

interface PlanDisplayProps {
  plan?: TravelPlan;
}

const typeStyles: Record<
  ScheduleItemType,
  {
    label: string;
    icon: string;
    badgeClassName: string;
    iconClassName: string;
    lineClassName: string;
  }
> = {
  spot: {
    label: "景点",
    icon: "景",
    badgeClassName: "bg-gradient-to-r from-cyan-300 to-emerald-300 text-slate-950",
    iconClassName: "bg-gradient-to-br from-cyan-300 to-emerald-300 text-slate-950 shadow-cyan-500/30",
    lineClassName: "from-cyan-300/70 via-white/15 to-emerald-300/30",
  },
  food: {
    label: "美食",
    icon: "食",
    badgeClassName: "bg-gradient-to-r from-orange-300 to-rose-400 text-slate-950",
    iconClassName: "bg-gradient-to-br from-orange-300 to-rose-400 text-slate-950 shadow-orange-500/35",
    lineClassName: "from-orange-300/70 via-white/15 to-rose-400/30",
  },
  transit: {
    label: "交通",
    icon: "行",
    badgeClassName: "bg-gradient-to-r from-amber-200 to-orange-300 text-slate-950",
    iconClassName: "bg-gradient-to-br from-amber-200 to-orange-300 text-slate-950 shadow-amber-500/30",
    lineClassName: "from-amber-200/70 via-white/15 to-orange-300/30",
  },
  rest: {
    label: "休整",
    icon: "歇",
    badgeClassName: "bg-gradient-to-r from-violet-300 to-fuchsia-400 text-white",
    iconClassName: "bg-gradient-to-br from-violet-300 to-fuchsia-400 text-white shadow-violet-500/30",
    lineClassName: "from-violet-300/70 via-white/15 to-fuchsia-400/30",
  },
};

export const mockTravelPlan: TravelPlan = {
  plan_id: "plan_1",
  plan_title: "美食松弛版·成都3天2晚",
  highlights: ["宽窄巷子慢逛拍照", "夜市小吃连吃路线", "本地火锅和盖碗茶体验"],
  budget_per_person: "1200-1500元",
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
    <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] text-white shadow-2xl shadow-black/40 backdrop-blur-2xl">
      <header className="relative border-b border-white/10 p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.28),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_30%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-200">
              Curated Itinerary
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-normal text-white sm:text-5xl">
              {plan.plan_title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              将路线、餐桌、交通和住宿压缩成一张可执行的旅行地图。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Budget</p>
            <p className="mt-2 text-3xl font-black text-orange-200">{plan.budget_per_person}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-300 to-rose-400"
                style={{ width: `${Math.min(100, Math.max(20, plan.pace_rating * 20))}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-white/45">节奏评分 {plan.pace_rating}/5</p>
          </div>
        </div>

        <div className="relative mt-7 flex flex-wrap gap-2">
          {plan.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/80 backdrop-blur-md"
            >
              {highlight}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:p-8">
        {plan.days.map((day) => (
          <article
            key={day.day_number}
            className="rounded-[1.75rem] border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-black/45 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">
                  Day {day.day_number}
                </span>
                <h3 className="mt-4 text-2xl font-black text-white">{day.day_theme}</h3>
                <p className="mt-2 text-sm text-white/50">{day.schedule.length} 个停靠点</p>
              </div>

              <div className="rounded-3xl border border-orange-200/20 bg-orange-300/10 px-5 py-4 sm:max-w-xs">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-100/70">
                  Stay
                </p>
                <p className="mt-2 text-sm font-black text-orange-100">
                  {day.accommodation.area_recommendation}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/55">{day.accommodation.reason}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {day.schedule.map((item, index) => {
                const style = typeStyles[item.type];

                return (
                  <div
                    key={`${day.day_number}-${item.time_bucket}-${index}`}
                    className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-4"
                  >
                    {index < day.schedule.length - 1 ? (
                      <span
                        className={`absolute left-6 top-14 h-[calc(100%+1rem)] w-px bg-gradient-to-b ${style.lineClassName}`}
                      />
                    ) : null}

                    <span
                      className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-sm font-black shadow-lg ${style.iconClassName}`}
                    >
                      {style.icon}
                    </span>

                    <div className="group rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.1]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/80">
                          {item.time_bucket}
                        </span>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${style.badgeClassName}`}>
                          {style.label}
                        </span>
                        <span className="text-xs font-semibold text-white/40">{item.duration}</span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <h4 className="text-xl font-black leading-tight text-white">{item.location}</h4>
                        <div>
                          <p className="text-sm leading-7 text-white/68">{item.activity}</p>
                          <p className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-medium leading-6 text-white/50">
                            {item.tips}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
