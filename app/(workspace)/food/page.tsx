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
    <div className="tuda-subpage">
      <header className="tuda-subpage-heading">
        <h1>美食偏好</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tuda-muted)]">
          在行程工作区选择口味，途搭会把餐厅、小吃和休息点排进每天的行程。
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {foodThemes.map((theme) => (
          <div key={theme.title} className="tuda-panel p-5 sm:p-6">
            <h2 className="text-lg font-bold">{theme.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--tuda-muted)]">{theme.description}</p>
          </div>
        ))}
      </div>

      <Link href="/" className="tuda-button-primary mt-6">
        去规划行程 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
