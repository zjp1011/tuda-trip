"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "../hooks/useUser";

const navItems = [
  { label: "行程生成", href: "/" },
  { label: "景点推荐", href: "/spots" },
  { label: "美食地图", href: "/food" },
  { label: "我的行程", href: "/diary" },
  { label: "预算助手", href: "/budget" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { guestLabel } = useUser();

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 border-r border-gray-100 bg-white px-5 py-6 md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-400 text-sm font-black text-white shadow-lg shadow-orange-500/20">
            途
          </div>
          <div>
            <p className="text-lg font-black text-gray-950">途搭</p>
            <p className="text-xs font-medium text-gray-400">Tuda Trip Studio</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-xs font-semibold text-orange-500">个人中心</p>
            <p className="mt-2 text-sm font-black text-gray-950">{guestLabel} (未绑定)</p>
          </div>

          <div className="rounded-3xl bg-gray-50 p-4">
            <p className="text-sm font-bold text-gray-950">今日灵感</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              输入城市、天数、预算和口味，让 AI 生成一条更像本地人的路线。
            </p>
          </div>
        </div>
      </aside>

      <header className="border-b border-white/10 bg-[#090909]/95 px-4 py-4 text-white backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-400 text-sm font-black text-white">
              途
            </div>
            <p className="text-lg font-black">途搭</p>
          </Link>
          <div className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/75">
            {guestLabel} (未绑定)
          </div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-white text-gray-950"
                    : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
