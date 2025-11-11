"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase-client";
import { AuthPanel } from "./auth-panel";
import { PlannerForm } from "./planner-form";
import { TripHistory } from "./trip-history";

export function HomeClient() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-semibold">AI Travel Planner</h1>
        <p className="text-lg text-slate-300">
          使用语音或文字描述你的旅程需求，几分钟内生成个性化行程、预算和地图展示。
        </p>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          <p>试试：“我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子。”</p>
        </div>
      </section>

      <AuthPanel session={session} />

      <PlannerForm userId={session?.user.id ?? null} />

  <TripHistory userId={session?.user.id ?? null} />

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-2xl font-semibold">接下来</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-300">
          <li>登录后可以保存和同步旅行计划（即将上线）。</li>
          <li>地图视图将在后续迭代中呈现分日行程路线。</li>
          <li>
            了解更多请查看
            <a href="/docs" className="ml-1 underline">
              产品文档
            </a>
            。
          </li>
        </ul>
      </section>
    </main>
  );
}
