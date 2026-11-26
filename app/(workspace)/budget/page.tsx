import Link from "next/link";

const budgets = [
  { title: "经济实惠", range: "500元以内/人", description: "优先公共交通、免费景点和本地小吃。" },
  { title: "舒适预算", range: "500-1500元/人", description: "兼顾效率、体验和有记忆点的餐厅。" },
  { title: "品质享受", range: "1500-3000元/人", description: "适合更好的住宿区位、预约制餐厅和特色体验。" },
  { title: "不设上限", range: "3000元以上/人", description: "优先独特体验、舒适交通和更精致的节奏。" },
];

export default function BudgetPage() {
  return (
    <div className="tuda-subpage">
      <header className="tuda-subpage-heading">
        <h1>预算指南</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tuda-muted)]">
          预算会影响住宿、交通、餐厅和景点安排。行程工作区也支持填写自定义人均金额。
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {budgets.map((budget) => (
          <div key={budget.title} className="tuda-panel p-5 sm:p-6">
            <p className="tuda-kicker">{budget.range}</p>
            <h2 className="mt-3 text-lg font-bold">{budget.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--tuda-muted)]">{budget.description}</p>
          </div>
        ))}
      </div>

      <Link href="/" className="tuda-button-primary mt-6">
        去填写预算 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
