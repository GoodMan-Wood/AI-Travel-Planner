"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

declare global {
  interface Window {
    BMapGL: any;
    __initBaiduMap?: () => void;
    __baiduMapPromise?: Promise<any>;
  }
}

export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  sourceText?: string | null;
  confidence?: number | null;
}

export interface MapLineCoordinate {
  lat: number;
  lng: number;
}

export interface MapSegment {
  startIndex: number;
  endIndex: number;
  coordinates: MapLineCoordinate[];
}

const BAIDU_MAP_AK = process.env.NEXT_PUBLIC_BAIDU_MAP_AK;

function loadBaiduScript(ak: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is undefined"));
  }

  if (window.BMapGL) {
    return Promise.resolve(window.BMapGL);
  }

  if (window.__baiduMapPromise) {
    return window.__baiduMapPromise;
  }

  window.__baiduMapPromise = new Promise((resolve, reject) => {
    const callbackName = "__initBaiduMap";
    window.__initBaiduMap = () => {
      if (window.BMapGL) {
        resolve(window.BMapGL);
      } else {
        reject(new Error("BMapGL not available"));
      }
      delete window.__initBaiduMap;
    };

    const script = document.createElement("script");
    script.src = `https://api.map.baidu.com/api?v=3.0&type=webgl&ak=${ak}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      reject(new Error("Failed to load Baidu Map script"));
      delete window.__initBaiduMap;
      window.__baiduMapPromise = undefined;
      script.remove();
    };
    document.body.appendChild(script);
  });

  return window.__baiduMapPromise;
}

interface TripMapProps {
  points: MapPoint[];
  segments?: MapSegment[];
  className?: string;
  height?: string;
  minHeight?: string;
}

export function TripMap({ points, segments = [], className, height = "24rem", minHeight }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPoints = points.length > 0;

  const bounds = useMemo(() => {
    if (!hasPoints) {
      return null;
    }
    const latitudes = points.map((point) => point.lat);
    const longitudes = points.map((point) => point.lng);
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes)
    };
  }, [hasPoints, points]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!containerRef.current) {
        return;
      }

      if (!BAIDU_MAP_AK) {
        setError("未配置 NEXT_PUBLIC_BAIDU_MAP_AK，无法加载百度地图。");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const BMapGL = await loadBaiduScript(BAIDU_MAP_AK);
        if (cancelled || !containerRef.current) {
          return;
        }

        const map = new BMapGL.Map(containerRef.current);
        map.enableScrollWheelZoom(true);
        mapRef.current = map;

        const defaultCenter = new BMapGL.Point(116.403875, 39.915168);
        map.centerAndZoom(defaultCenter, 5);
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "地图加载失败");
          setLoading(false);
        }
      }
    };

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.clearOverlays();
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to clear overlays during cleanup", err);
          }
        }
        try {
          if (typeof mapRef.current.destroy === "function") {
            mapRef.current.destroy();
          }
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to destroy Baidu map instance", err);
          }
        }
        mapRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.BMapGL) {
      return;
    }

    try {
      map.clearOverlays();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to clear Baidu map overlays", err);
      }
    }

    if (!hasPoints) {
      return;
    }

    const BMapGL = window.BMapGL;
    const pointObjects = points.map((point) => new BMapGL.Point(point.lng, point.lat));

    if (pointObjects.length === 1) {
      try {
        map.centerAndZoom(pointObjects[0], 13);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to center Baidu map on single point", err);
        }
      }
    }

    pointObjects.forEach((pointObj, index) => {
      const marker = new BMapGL.Marker(pointObj);
      marker.setTitle(points[index].name);
      const label = new BMapGL.Label(`${index + 1}. ${points[index].name}`, {
        offset: new BMapGL.Size(12, -18)
      });
      label.setStyle({
        color: "#e2e8f0",
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        border: "1px solid rgba(148, 163, 184, 0.4)",
        borderRadius: "12px",
        padding: "4px 8px",
        fontSize: "12px",
        lineHeight: "16px"
      });
      marker.setLabel(label);

      const infoHtml = `
        <div style="min-width: 180px; color: #1e293b;">
          <strong>${points[index].name}</strong>
          ${points[index].address ? `<p style="margin: 6px 0 0; font-size: 12px;">${points[index].address}</p>` : ""}
          ${points[index].sourceText ? `<p style="margin: 8px 0 0; font-size: 12px; color: #475569;">${points[index].sourceText}</p>` : ""}
          <a href="https://map.baidu.com/direction?destination=${points[index].lat},${points[index].lng}&mode=driving" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:12px;color:#2563eb;">在百度地图中导航</a>
        </div>
      `;
      const infoWindow = new BMapGL.InfoWindow(infoHtml, { width: 260, height: 120 });
      marker.addEventListener("click", () => {
        map.openInfoWindow(infoWindow, pointObj);
      });

      try {
        map.addOverlay(marker);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to add marker to Baidu map", err);
        }
      }
    });

    const segmentPointGroups: any[] = [];

    if (segments.length > 0) {
      segments.forEach((segment) => {
        const coords = Array.isArray(segment.coordinates) ? segment.coordinates : [];
        const pointsForSegment = coords
          .filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng))
          .map((coord) => new BMapGL.Point(coord.lng, coord.lat));
        if (pointsForSegment.length >= 2) {
          segmentPointGroups.push(pointsForSegment);
        }
      });
    }

    if (segmentPointGroups.length === 0 && pointObjects.length >= 2) {
      segmentPointGroups.push(pointObjects);
    }

    segmentPointGroups.forEach((group) => {
      const polyline = new BMapGL.Polyline(group, {
        strokeColor: "#38bdf8",
        strokeWeight: 4,
        strokeOpacity: 0.8,
        strokeStyle: "solid"
      });
      try {
        map.addOverlay(polyline);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to add polyline to Baidu map", err);
        }
      }
    });

    if (bounds) {
      const hasLatSpan = bounds.maxLat - bounds.minLat > 0.0001;
      const hasLngSpan = bounds.maxLng - bounds.minLng > 0.0001;
      if (hasLatSpan || hasLngSpan) {
        const sw = new BMapGL.Point(bounds.minLng, bounds.minLat);
        const ne = new BMapGL.Point(bounds.maxLng, bounds.maxLat);
        try {
          map.setViewport([sw, ne], { margins: [40, 40, 40, 40] });
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to set viewport on Baidu map", err);
          }
        }
      } else if (pointObjects.length > 0) {
        try {
          map.centerAndZoom(pointObjects[0], 13);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to center Baidu map when bounds collapsed", err);
          }
        }
      }
    }
  }, [bounds, hasPoints, points, segments]);

  return (
    <div className={clsx("relative flex flex-col gap-3", className)}>
      {loading ? (
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs text-slate-200 shadow">
          地图加载中...
        </span>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-xs text-red-100">
          {error}
        </p>
      ) : null}
      <div
        ref={containerRef}
        className={clsx(
          "w-full overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/60",
          !hasPoints && "flex items-center justify-center"
        )}
        style={{
          height,
          minHeight: minHeight ?? height
        }}
      >
        {!hasPoints && !error && !loading ? (
          <p className="text-sm text-slate-500">当前行程暂无可展示的地点。</p>
        ) : null}
      </div>
    </div>
  );
}
