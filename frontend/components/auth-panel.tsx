"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase-client";

interface AuthPanelProps {
  session: Session | null;
}

export function AuthPanel({ session }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setStatus(null);

    try {
      if (!email || !password) {
        setStatus("请输入邮箱和密码。");
        return;
      }

      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("登录成功。");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("注册成功，请查收验证邮件或直接登录。");
        setMode("signIn");
      }

      setEmail("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setStatus("已退出登录。");
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-2xl font-semibold">账号管理</h2>
      {session ? (
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p>当前用户：{session.user.email ?? session.user.id}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            退出登录
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="w-24 text-sm text-slate-300" htmlFor="auth-email">
              邮箱
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950/70 p-2 text-sm text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="w-24 text-sm text-slate-300" htmlFor="auth-password">
              密码
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950/70 p-2 text-sm text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="不少于 6 位"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleAuth}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {mode === "signIn" ? "登录" : "注册"}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              className="text-xs text-brand-300 underline"
            >
              {mode === "signIn" ? "我要注册" : "已有账号? 去登录"}
            </button>
          </div>
        </div>
      )}
      {status ? <p className="mt-3 text-xs text-slate-400">{status}</p> : null}
    </section>
  );
}
