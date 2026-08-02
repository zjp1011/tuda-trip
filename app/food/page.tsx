import Link from "next/link";

const foodThemes = [
  { title: "地道小吃", description: "适合想把早餐、夜宵和老店都排进路线的人。" },
  { title: "网红餐厅", description: "适合重视环境、出片和社交分享的旅行。" },
  { title: "夜市探店", description: "适合晚间活动丰富、喜欢边走边吃的行程。" },
  { title: "特色火锅", description: "适合川渝、潮汕、云南等强地域饮食主题。" },
  { title: "甜品咖啡", description: "适合松弛下午、街区漫游和轻量休息点。" },
  { title: "本地老店", description: "适合避开游客店，优先找城市日常味道。" },
];

export default function FoodPage() {
  return (
    <div className="min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
          Food Map
        </p>
        <h1 className="mt-2 text-3xl font-black">美食地图</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
          这些偏好已经能在首页生成路线时选择，AI 会把餐厅、小吃和休息点编进每天的时间轴。
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {foodThemes.map((theme) => (
            <div
              key={theme.title}
              className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/[0.09]"
            >
              <h2 className="text-xl font-black">{theme.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/50">{theme.description}</p>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-gradient-to-r from-orange-400 to-red-400 px-6 py-3 text-sm font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:-translate-y-0.5"
        >
          去生成含美食路线
        </Link>
      </div>
    </div>
  );
}
