import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Travel Planner",
  description: "Plan smarter trips with AI-powered itineraries and budget tracking."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="relative min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-36 top-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 lg:px-10">
          {children}
        </div>
      </body>
    </html>
  );
}
