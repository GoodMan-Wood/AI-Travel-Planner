"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase-client";
import { AuthPanel } from "./auth-panel";
import { PlannerForm } from "./planner-form";
import { TripHistory } from "./trip-history";
import type { MapPoint as TripMapPoint, MapSegment as TripMapSegment } from "./trip-map";

export function HomeClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [focusTripId, setFocusTripId] = useState<string | null>(null);
  const [latestMapTripId, setLatestMapTripId] = useState<string | null>(null);
  const [latestMapCity, setLatestMapCity] = useState<string | null>(null);
  const [latestMapPoints, setLatestMapPoints] = useState<TripMapPoint[]>([]);
  const [latestMapSegments, setLatestMapSegments] = useState<TripMapSegment[]>([]);
  const [latestMapLoading, setLatestMapLoading] = useState(false);
  const [latestMapError, setLatestMapError] = useState<string | null>(null);

  const resetHomepageMap = useCallback(() => {
    setLatestMapTripId(null);
    setLatestMapCity(null);
    setLatestMapPoints([]);
    setLatestMapSegments([]);
    setLatestMapError(null);
    setLatestMapLoading(false);
  }, []);

  const handleLatestMapUpdate = useCallback(
    (update: {
      tripId: string | null;
      city: string | null;
      points: TripMapPoint[];
      segments: TripMapSegment[];
      error: string | null;
      loading: boolean;
    }) => {
      setLatestMapTripId(update.tripId);
      setLatestMapCity(update.city);
      setLatestMapPoints(update.points);
      setLatestMapSegments(update.segments);
      setLatestMapError(update.error);
      setLatestMapLoading(update.loading);
    },
    []
  );

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

  useEffect(() => {
    if (!session) {
      setHistoryRefreshToken(0);
      setFocusTripId(null);
      resetHomepageMap();
    }
  }, [session, resetHomepageMap]);

  return (
    <div className="page-stack">
      <header className="top-bar">
        <div className="top-bar__inner">
          <div className="top-bar__brand">
            <span className="top-bar__logo">TravelMind</span>
            <span className="top-bar__subtitle">AI 智能旅行规划</span>
          </div>
          <AuthPanel session={session} variant="nav" />
        </div>
      </header>

      <main className="main-layout">
        <section className="hero-card">
        <div className="hero-card__grid">
          <div className="space-y-5">
            <span className="hero-badge">
              智能旅行助手
              <span style={{ width: 6, height: 6, borderRadius: "999px", background: "#60a5fa" }} />
            </span>
            <h1 style={{ fontSize: "3rem", lineHeight: 1.1, margin: 0 }}>更聪明地规划下一趟旅程</h1>
            <p style={{ fontSize: "1.05rem", color: "#cbd5f5", maxWidth: "36rem" }}>
              描述旅程意向与预算，AI 即刻生成行程、费用拆分和支出记录工具，让旅行准备像发送消息一样简单。
            </p>
            <div className="planner-toolbar">
              <a href="#planner" className="hero-cta">
                立即生成行程
              </a>
              <div className="hero-stats">
                <div>
                  <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc" }}>2 分钟</p>
                  <p style={{ color: "#cbd5f5", fontSize: "0.85rem" }}>生成多日行程计划</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc" }}>多终端</p>
                  <p style={{ color: "#cbd5f5", fontSize: "0.85rem" }}>云端同步随时查看</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc" }}>预算</p>
                  <p style={{ color: "#cbd5f5", fontSize: "0.85rem" }}>实时记录每一笔支出</p>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-preview">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#cbd5f5" }}>
              <div>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#64748b" }}>
                  工作流预览
                </p>
                <h2 style={{ marginTop: "0.5rem", fontSize: "1.5rem", color: "#e2e8f0" }}>规划 → 预算 → 管理</h2>
              </div>
              <ul style={{ display: "grid", gap: "0.8rem", fontSize: "0.9rem", lineHeight: 1.4 }}>
                <li>语音或文字输入旅程灵感，自动解析重点需求。</li>
                <li>一键生成每日行程与预算拆分，支持自定义调整。</li>
                <li>实时记录费用，随时查看剩余预算与开支趋势。</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

        <section id="planner" className="planner-section">
          <div className="planner-stack">
            <PlannerForm
              userId={session?.user.id ?? null}
              onPlanCreated={(tripId) => {
                setHistoryRefreshToken((prev) => prev + 1);
                if (!tripId) {
                  resetHomepageMap();
                  setLatestMapError("行程尚未存档（未登录或数据服务未配置），暂无法生成地图。");
                  return;
                }

                if (session?.user?.id) {
                  setFocusTripId(tripId);
                  setLatestMapTripId(tripId);
                  setLatestMapCity(null);
                  setLatestMapPoints([]);
                  setLatestMapSegments([]);
                  setLatestMapError(null);
                  setLatestMapLoading(true);
                } else {
                  resetHomepageMap();
                  setLatestMapTripId(tripId);
                  setLatestMapCity(null);
                  setLatestMapError("登录后即可查看行程地图。");
                }
              }}
              mapPoints={latestMapPoints}
              mapSegments={latestMapSegments}
              mapLoading={latestMapLoading}
              mapError={latestMapError}
              mapTripId={latestMapTripId}
              mapCity={latestMapCity}
            />
            <TripHistory
              userId={session?.user.id ?? null}
              refreshToken={historyRefreshToken}
              focusTripId={focusTripId}
              onMapDataChange={handleLatestMapUpdate}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
