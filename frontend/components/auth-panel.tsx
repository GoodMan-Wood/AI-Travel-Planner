"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase-client";

interface AuthPanelProps {
  session: Session | null;
  variant?: "card" | "nav";
  supabaseAvailable?: boolean;
}

export function AuthPanel({ session, variant = "card", supabaseAvailable = true }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const dropdownId = "user-nav-dropdown";

  const supabaseClient = supabaseAvailable && supabase ? supabase : null;
  const supabaseReady = Boolean(supabaseClient);

  const handleAuth = async () => {
    if (!supabaseReady || !supabaseClient) {
      setStatus("尚未配置 Supabase，暂无法登录。");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      if (!email || !password) {
        setStatus("请输入邮箱和密码。");
        return;
      }

      if (mode === "signIn") {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("登录成功。");
      } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
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
    if (!supabaseReady || !supabaseClient) {
      setStatus("尚未配置 Supabase，暂无法注销。");
      return;
    }

    await supabaseClient.auth.signOut();
    setStatus("已退出登录。");
    if (variant === "nav") {
      setPanelOpen(true);
    }
  };

  useEffect(() => {
    if (!supabaseReady) {
      setPanelOpen(false);
      return;
    }

    if (variant === "nav" && session) {
      setPanelOpen(false);
      setEmail("");
      setPassword("");
      setMode("signIn");
    }
  }, [session, variant, supabaseReady]);

  if (variant === "nav") {
    return (
      <div className="user-nav">
        {session ? (
          <div className="user-nav__session">
            <span className="user-nav__user">{session.user.email ?? session.user.id}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="user-nav__button"
              disabled={loading}
            >
              退出登录
            </button>
          </div>
        ) : (
          <div className={`user-nav__auth${panelOpen ? " is-open" : ""}`}>
            <button
              type="button"
              onClick={() => (supabaseReady ? setPanelOpen((prev) => !prev) : null)}
              className="user-nav__toggle"
              aria-expanded={panelOpen}
              aria-controls={dropdownId}
              disabled={!supabaseReady}
            >
              {!supabaseReady ? "登录暂不可用" : panelOpen ? "收起" : "登录 / 注册"}
            </button>
            {panelOpen && supabaseReady ? (
              <div id={dropdownId} className="user-nav__dropdown">
                <div className="user-nav__fields">
                  <label className="user-nav__label" htmlFor="auth-email-nav">
                    邮箱
                  </label>
                  <input
                    id="auth-email-nav"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="user-nav__input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading || !supabaseReady}
                  />
                </div>
                <div className="user-nav__fields">
                  <label className="user-nav__label" htmlFor="auth-password-nav">
                    密码
                  </label>
                  <input
                    id="auth-password-nav"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="user-nav__input"
                    placeholder="不少于 6 位"
                    autoComplete="current-password"
                    disabled={loading || !supabaseReady}
                  />
                </div>
                <div className="user-nav__actions">
                  <button
                    type="button"
                    onClick={handleAuth}
                    className="user-nav__button user-nav__button--primary"
                    disabled={loading || !supabaseReady}
                  >
                    {loading ? "提交中..." : mode === "signIn" ? "登录" : "注册"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
                    className="user-nav__link"
                    disabled={!supabaseReady}
                  >
                    {mode === "signIn" ? "我要注册" : "已有账号? 去登录"}
                  </button>
                </div>
                {status ? <p className="user-nav__status">{status}</p> : null}
              </div>
            ) : null}
            {!supabaseReady ? <p className="user-nav__status">Supabase 未配置，登录不可用。</p> : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6 shadow-lg shadow-slate-950/30">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">账号管理</h2>
        <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Supabase</span>
      </div>
      {session ? (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
          <div>
            <p className="text-xs text-slate-500">当前用户</p>
            <p className="mt-1 text-base font-medium text-slate-100">
              {session.user.email ?? session.user.id}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-slate-700/70 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-400/60 hover:text-brand-200"
          >
            退出登录
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="auth-email">
              邮箱
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700/70 bg-slate-950/80 p-3 text-sm text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading || !supabaseReady}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400" htmlFor="auth-password">
              密码
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700/70 bg-slate-950/80 p-3 text-sm text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="不少于 6 位"
              autoComplete="current-password"
              disabled={loading || !supabaseReady}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleAuth}
              className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !supabaseReady}
            >
              {mode === "signIn" ? "登录" : "注册"}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              className="text-xs font-medium text-brand-300 underline"
              disabled={!supabaseReady}
            >
              {mode === "signIn" ? "我要注册" : "已有账号? 去登录"}
            </button>
          </div>
        </div>
      )}
      {status ? (
        <p className="mt-4 rounded-lg bg-slate-950/70 p-3 text-xs text-slate-400">{status}</p>
      ) : null}
      {!supabaseReady ? (
        <p className="mt-4 rounded-lg bg-slate-950/70 p-3 text-xs text-red-300/80">
          尚未配置 Supabase 服务，登录与注册功能暂不可用。
        </p>
      ) : null}
    </section>
  );
}
