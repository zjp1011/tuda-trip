import Link from "next/link";
import PlanDisplay from "../../../components/PlanDisplay";
import { getSharedRoute } from "../../../lib/serverSharedRoutes";

type SharePageProps = {
  params: Promise<{
    shareId: string;
  }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  const sharedRoute = await getSharedRoute(shareId);

  if (!sharedRoute) {
    return (
      <div className="min-h-screen bg-[#070707] px-5 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
            Tuda Share
          </p>
          <h1 className="mt-3 text-3xl font-black">分享行程不存在</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            链接可能填写错误，或者分享记录已经失效。
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition-all hover:bg-orange-100"
          >
            去生成我的路线
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-white/10 bg-black/30 px-5 py-6 backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
              Tuda Share
            </p>
            <h1 className="mt-2 text-3xl font-black">{sharedRoute.title}</h1>
            <p className="mt-2 text-sm text-white/45">
              {sharedRoute.destination} · 分享于{" "}
              {new Date(sharedRoute.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-gradient-to-r from-orange-400 to-red-400 px-5 py-3 text-sm font-black text-white shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-0.5"
          >
            生成我的路线
          </Link>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-8 lg:px-12">
        <PlanDisplay plan={sharedRoute.plan} />
      </main>
    </div>
  );
}
