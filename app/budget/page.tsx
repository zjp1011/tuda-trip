import Link from "next/link";

const budgets = [
  { title: "经济实惠", range: "500元以内/人", description: "优先公共交通、免费景点和本地小吃。" },
  { title: "舒适预算", range: "500-1500元/人", description: "兼顾效率、体验和有记忆点的餐厅。" },
  { title: "品质享受", range: "1500-3000元/人", description: "适合更好的住宿区位、预约制餐厅和特色体验。" },
  { title: "不设上限", range: "3000元以上/人", description: "优先独特体验、舒适交通和更精致的节奏。" },
];

export default function BudgetPage() {
  return (
    <div className="min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
          Budget Guide
        </p>
        <h1 className="mt-2 text-3xl font-black">预算助手</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
          预算会直接影响住宿区域、交通方式、餐厅密度和景点选择。首页也支持填写自定义人均金额。
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => (
            <div
              key={budget.title}
              className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/[0.09]"
            >
              <p className="text-sm font-black text-orange-200">{budget.range}</p>
              <h2 className="mt-3 text-xl font-black">{budget.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/50">{budget.description}</p>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-orange-100"
        >
          返回首页填写预算
        </Link>
      </div>
    </div>
  );
}
