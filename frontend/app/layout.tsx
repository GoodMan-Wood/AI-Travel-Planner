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
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
