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
      <div className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="tuda-panel mx-auto max-w-3xl p-8 text-center">
          <p className="tuda-kicker">途搭 / 分享行程</p>
          <h1 className="mt-3 text-3xl font-black">分享行程不存在</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            链接可能填写错误，或者分享记录已经失效。
          </p>
          <Link
            href="/"
            className="tuda-button-primary mt-6"
          >
            去生成我的路线
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--tuda-line)] bg-[#101b29] px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="tuda-kicker">途搭 / 分享行程</p>
            <h1 className="mt-2 text-3xl font-black">{sharedRoute.title}</h1>
            <p className="mt-2 text-sm text-white/45">
              {sharedRoute.destination}
              {sharedRoute.departureDate ? " · " + sharedRoute.departureDate + " 出发" : ""}
              {" · 分享于 "}
              {new Date(sharedRoute.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <Link
            href="/"
            className="tuda-button-primary"
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
