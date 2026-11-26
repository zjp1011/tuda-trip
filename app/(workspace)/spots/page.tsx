import Link from "next/link";

const destinations = [
  { label: "成都", title: "老街烟火与盖碗茶", description: "适合美食探索、城市漫游和松弛周末。" },
  { label: "厦门", title: "海边散步与岛屿日落", description: "适合情侣、朋友和慢节奏拍照路线。" },
  { label: "大理", title: "山海之间的轻度假", description: "适合自然风光、咖啡店和环海发呆。" },
  { label: "上海", title: "展览、街区与夜景", description: "适合城市文化、餐厅探店和周末短途。" },
  { label: "杭州", title: "湖边清晨与茶山下午", description: "适合自然风光、亲子和低强度散步。" },
  { label: "重庆", title: "山城夜色与热辣小吃", description: "适合夜市探店、火锅和特色街区。" },
];

export default function SpotsPage() {
  return (
    <div className="tuda-subpage">
      <header className="tuda-subpage-heading">
        <h1>目的地灵感</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--tuda-muted)]">
          选择一座城市，带入行程工作区，再按天数、预算和口味规划。
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {destinations.map((destination) => (
          <Link
            key={destination.label}
            href={`/?city=${encodeURIComponent(destination.label)}`}
            className="tuda-panel flex flex-col p-5 hover:border-[#4d8c8d] sm:p-6"
          >
            <p className="tuda-kicker">{destination.label}</p>
            <h2 className="mt-3 text-lg font-bold">{destination.title}</h2>
            <p className="mt-2 mb-5 text-sm leading-6 text-[var(--tuda-muted)]">{destination.description}</p>
            <span className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--tuda-line)] pt-3 text-xs font-semibold text-[var(--tuda-accent)]">
              选择这个城市
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
