import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "途搭",
  description: "AI 旅行计划生成器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
