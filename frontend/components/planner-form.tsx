"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import clsx from "clsx";

import {
  getSpeechRecognitionConstructor,
  isSecureSpeechContext,
  type SpeechRecognitionInstance,
} from "../lib/speech-recognition";
import { TripMap, type MapPoint as TripMapPoint, type MapSegment as TripMapSegment } from "./trip-map";

interface PlannerResponse {
  itinerary: string;
  budget: {
    total: number;
    currency: string;
    breakdown: Array<{ category: string; amount: number }>;
  };
  tripId?: string | null;
}

interface PlannerFormProps {
  userId: string | null;
  onPlanCreated?: (tripId: string | null) => void;
  mapPoints?: TripMapPoint[];
  mapSegments?: TripMapSegment[];
  mapLoading?: boolean;
  mapError?: string | null;
  mapTripId?: string | null;
  mapCity?: string | null;
}

const PLACEHOLDER_INPUT = "我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子";

export function PlannerForm({
  userId,
  onPlanCreated,
  mapPoints = [],
  mapSegments = [],
  mapLoading = false,
  mapError = null,
  mapTripId = null,
  mapCity = null
}: PlannerFormProps) {
  const [intent, setIntent] = useState(PLACEHOLDER_INPUT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlannerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));
      setIsSecureContext(isSecureSpeechContext());
    }

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<PlannerResponse>("/api/itineraries", {
        intent,
        userId: userId ?? undefined
      });
      setResult(response.data);
      onPlanCreated?.(response.data.tripId ?? null);
    } catch (err) {
      setError("暂时无法生成行程，请稍后再试。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartListening = () => {
    if (isListening) {
      return;
    }

    if (!isSecureContext) {
      setVoiceError("Web Speech API 需在 HTTPS 或 localhost 环境下使用。");
      return;
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setVoiceError("当前浏览器不支持 Web Speech API 语音识别。");
      return;
    }

    setVoiceError(null);

    const recognition = new RecognitionCtor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const collected = Array.from(event.results ?? [])
        .map((result: any) => result[0]?.transcript ?? "")
        .filter(Boolean)
        .join(" ")
        .trim();

      if (collected) {
        setIntent((prev) => (prev ? `${prev.trim()} ${collected}`.trim() : collected));
      } else {
        setVoiceError("未识别到有效语音内容，请重试。");
      }
    };

    recognition.onerror = (event: any) => {
      const reason = event.error === "not-allowed"
        ? "麦克风权限被拒绝，请检查浏览器设置。"
        : event.error === "no-speech"
          ? "未检测到语音，请重试。"
          : "语音识别失败，请稍后再试。";
      setVoiceError(reason);
      setIsListening(false);
      try {
        recognition.stop();
      } catch (stopError) {
        console.warn("Failed to stop recognition after error", stopError);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error(err);
      setVoiceError("无法启动语音识别，请稍后再试。");
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  const handleStopListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognition.stop();
    setIsListening(false);
  };

  return (
    <div className="planner-module">
      <div className="planner-primary">
        <form onSubmit={handleSubmit} className="planner-card">
          <div className="planner-card__content">
            <header className="planner-card__header">
              <div>
                <p className="planner-card__eyebrow">STEP · 01</p>
                <h2 className="planner-card__title">描述你的旅行计划</h2>
              </div>
              <p className="planner-card__description">
                输入想去的地点、行程天数、预算以及偏好，我们将即时为你组合每日路线、预算拆分与支出规划。
              </p>
            </header>
            <textarea
              id="intent"
              name="intent"
              value={intent}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setIntent(event.target.value)}
              rows={5}
              className="planner-card__textarea"
              placeholder={PLACEHOLDER_INPUT}
              disabled={loading}
            />
            <div className="planner-card__actions">
              <button
                type="submit"
                className={clsx("planner-card__submit", loading && "is-loading")}
                disabled={loading}
              >
                {loading ? "生成中..." : "生成行程方案"}
              </button>
              <button
                type="button"
                onClick={isListening ? handleStopListening : handleStartListening}
                className={clsx(
                  "planner-card__mic voice-button",
                  isListening && "is-recording",
                  (!speechSupported || !isSecureContext) && "is-disabled"
                )}
                disabled={loading || !speechSupported || !isSecureContext}
              >
                {isListening ? "结束录音" : "语音输入"}
              </button>
              <span className="planner-card__hint">
                {isListening
                  ? "语音识别中，请开始讲话..."
                  : !isSecureContext
                    ? "请通过 HTTPS 或在 localhost 下使用语音识别"
                    : !speechSupported
                      ? "当前浏览器暂不支持 Web Speech API"
                      : "支持语音或文字描述旅程意向"}
              </span>
            </div>
            {voiceError ? <p className="planner-card__voice-error">{voiceError}</p> : null}
          </div>
        </form>

        <section className="planner-map-card">
          <header className="planner-map-card__header">
            <div>
              <p className="planner-map-card__eyebrow">STEP · 02</p>
              <h2 className="planner-map-card__title">行程地图</h2>
            </div>
            {mapTripId ? <span className="planner-map-card__badge">行程 ID：{mapTripId}</span> : null}
          </header>
          <p className="planner-map-card__description">
            最新生成的行程地点会实时绘制在下方地图中，方便快速确认路线与地理分布。
          </p>
          <div className="planner-map-card__status">
            {mapLoading ? (
              <span className="planner-map-card__status-item planner-map-card__status-item--loading">
                地图数据加载中...
              </span>
            ) : null}
            {mapError ? (
              <span className="planner-map-card__status-item planner-map-card__status-item--error">
                {mapError}
              </span>
            ) : null}
            {!mapLoading && !mapError && mapCity ? (
              <span className="planner-map-card__status-item">
                当前城市：{mapCity}
              </span>
            ) : null}
            {!mapLoading && !mapError && !mapTripId ? (
              <span className="planner-map-card__status-item planner-map-card__status-item--muted">
                生成行程后将自动展示地图。
              </span>
            ) : null}
          </div>
          <TripMap
            points={mapPoints}
            segments={mapSegments}
            className="planner-map-card__canvas"
            height="28rem"
            minHeight="24rem"
          />
        </section>
      </div>

      {error ? <div className="planner-error">{error}</div> : null}

      {result ? (
        <div className="planner-output">
          <section className="planner-output__panel">
            <div className="planner-output__heading">
              <h3>AI 行程建议</h3>
              {result.tripId ? <span className="planner-output__badge">已保存：{result.tripId}</span> : null}
            </div>
            <pre className="planner-output__itinerary">{result.itinerary}</pre>
          </section>
          <section className="planner-output__panel planner-output__panel--accent">
            <h3>预算概览</h3>
            <div className="planner-output__budget">
              <p className="planner-output__total">
                总预算：{result.budget.total} {result.budget.currency}
              </p>
              <ul className="planner-output__breakdown">
                {result.budget.breakdown.map((item) => (
                  <li key={item.category}>
                    <span>{item.category}</span>
                    <span>
                      {item.amount} {result.budget.currency}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
