"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "../hooks/useUser";

const navItems = [
  { label: "行程规划", href: "/", icon: "route" },
  { label: "我的行程", href: "/diary", icon: "book" },
  { label: "目的地灵感", href: "/spots", icon: "pin" },
  { label: "美食偏好", href: "/food", icon: "food" },
  { label: "预算指南", href: "/budget", icon: "budget" },
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
    <aside className="tuda-sidebar">
      <div className="tuda-sidebar-head">
        <Link href="/" className="tuda-brand">
          <span className="tuda-mark" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">途搭</span>
        </Link>
        <span className="text-xs text-[var(--tuda-muted)] lg:hidden">{guestLabel}</span>
      </div>
      <nav aria-label="途搭导航" className="tuda-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
            className="tuda-nav-link"
          >
            <span aria-hidden="true" className="tuda-nav-symbol" data-icon={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="tuda-sidebar-footer">
        <p className="text-xs leading-5 text-[var(--tuda-muted)]">{guestLabel}</p>
      </div>
    </aside>
  );
}
