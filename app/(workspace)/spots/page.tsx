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
    <div className="min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
          Destination Picks
        </p>
        <h1 className="mt-2 text-3xl font-black">景点推荐</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
          先挑一个有感觉的城市，再回到生成器里让 AI 按你的天数、预算和口味生成完整路线。
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {destinations.map((destination) => (
            <Link
              key={destination.label}
              href={`/?city=${encodeURIComponent(destination.label)}`}
              className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/[0.09]"
            >
              <p className="text-sm font-black text-orange-200">{destination.label}</p>
              <h2 className="mt-3 text-xl font-black">{destination.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/50">{destination.description}</p>
              <span className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">
                用这个城市生成
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
