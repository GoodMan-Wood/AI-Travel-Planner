"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import clsx from "clsx";

interface PlannerResponse {
  itinerary: string;
  budget: {
    total: number;
    currency: string;
    breakdown: Array<{ category: string; amount: number }>;
  };
  tripId?: string | null;
}

const PLACEHOLDER_INPUT = "我想去日本，5 天，预算 1 万元，喜欢美食和动漫，带孩子";

interface PlannerFormProps {
  userId: string | null;
}

export function PlannerForm({ userId }: PlannerFormProps) {
  const [intent, setIntent] = useState(PLACEHOLDER_INPUT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlannerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError("暂时无法生成行程，请稍后再试。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6"
      >
        <label className="block text-sm font-medium text-slate-300" htmlFor="intent">
          描述你的旅行计划
        </label>
        <textarea
          id="intent"
          name="intent"
          value={intent}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setIntent(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-slate-700 bg-slate-950/80 p-3 text-slate-50 shadow focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={PLACEHOLDER_INPUT}
          disabled={loading}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className={clsx(
              "rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-400",
              loading && "cursor-not-allowed opacity-70"
            )}
            disabled={loading}
          >
            {loading ? "生成中..." : "生成行程"}
          </button>
          <span className="text-xs text-slate-500">
            语音输入将在后续迭代接入科大讯飞识别。
          </span>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-red-500/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <section>
            <h3 className="text-xl font-semibold">AI 行程建议</h3>
            {result.tripId ? (
              <p className="mt-1 text-xs text-brand-300">
                已保存至云端，编号：{result.tripId}
              </p>
            ) : null}
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{result.itinerary}</pre>
          </section>
          <section>
            <h3 className="text-xl font-semibold">预算概览</h3>
            <p className="mt-1 text-sm text-slate-300">
              总预算：{result.budget.total} {result.budget.currency}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {result.budget.breakdown.map((item) => (
                <li key={item.category} className="flex justify-between">
                  <span>{item.category}</span>
                  <span>
                    {item.amount} {result.budget.currency}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
