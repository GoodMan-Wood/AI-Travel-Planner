"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import clsx from "clsx";

interface BudgetBreakdownEntry {
  category?: string;
  amount?: number;
}

interface TripSummary {
  id: string;
  title: string;
  intent: string;
  created_at: string;
  total_budget: number | null;
  currency: string | null;
  budget_breakdown?: BudgetBreakdownEntry[] | null;
  total_expenses?: number | null;
  remaining_budget?: number | null;
}

interface TripDetail extends TripSummary {
  generated_itinerary: string | null;
  updated_at?: string | null;
}

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  currency: string;
  occurredOn?: string | null;
  occurred_on?: string | null;
  created_at: string;
}

interface ExpenseDraft {
  category: string;
  amount: string;
  currency: string;
  occurredOn: string;
}

interface TripHistoryProps {
  userId: string | null;
  refreshToken?: number;
  focusTripId?: string | null;
}

export function TripHistory({ userId, refreshToken = 0, focusTripId = null }: TripHistoryProps) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>({
    category: "餐饮",
    amount: "",
    currency: "CNY",
    occurredOn: ""
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(null);
  const selectedTripId = selectedTrip?.id ?? null;

  useEffect(() => {
    const loadTrips = async () => {
      if (!userId) {
        setTrips([]);
        setSelectedTrip(null);
        setExpenses([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<TripSummary[]>("/api/trips", {
          params: { userId }
        });
        setTrips(response.data);

        if (selectedTripId) {
          const matched = response.data.find((trip) => trip.id === selectedTripId);
          if (matched) {
            setSelectedTrip((prev) =>
              prev
                ? {
                    ...prev,
                    title: matched.title,
                    intent: matched.intent,
                    total_budget: matched.total_budget,
                    currency: matched.currency,
                    budget_breakdown: matched.budget_breakdown,
                    total_expenses: matched.total_expenses,
                    remaining_budget:
                      matched.remaining_budget ??
                      (matched.total_budget != null && matched.total_expenses != null
                        ? matched.total_budget - matched.total_expenses
                        : matched.total_budget ?? null)
                  }
                : prev
            );
          }
        }
      } catch (err) {
        console.error(err);
        setError("暂时无法获取行程历史。");
      } finally {
        setLoading(false);
      }
    };

    void loadTrips();
  }, [userId, refreshToken, selectedTripId]);
  const handleViewDetail = useCallback(async (trip: TripSummary) => {
    setSelectedTrip({
      ...trip,
      generated_itinerary: null,
      updated_at: null,
      total_expenses: trip.total_expenses ?? null,
      remaining_budget:
        trip.remaining_budget ??
        (trip.total_budget != null && trip.total_expenses != null
          ? trip.total_budget - trip.total_expenses
          : trip.total_budget ?? null)
    });
    setDetailLoading(true);
    setDetailError(null);
    setExpensesLoading(true);
    setExpenseError(null);
    setEditingExpenseId(null);
    setEditDraft(null);
    try {
      const response = await axios.get<TripDetail>(`/api/trips/${trip.id}`, {
        params: { userId }
      });
      setSelectedTrip(response.data);
    } catch (err) {
      console.error(err);
      setDetailError("暂时无法加载行程详情。");
    } finally {
      setDetailLoading(false);
    }

    try {
      const response = await axios.get<ExpenseItem[]>("/api/expenses", {
        params: { userId, tripId: trip.id }
      });
      setExpenses(response.data);
    } catch (err) {
      console.error(err);
      setExpenseError("暂时无法加载费用记录。");
    } finally {
      setExpensesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!focusTripId || focusTripId === selectedTripId || trips.length === 0) {
      return;
    }

    const targetTrip = trips.find((trip) => trip.id === focusTripId);
    if (targetTrip) {
      void handleViewDetail(targetTrip);
    }
  }, [focusTripId, trips, handleViewDetail, selectedTripId]);

  if (!userId) {
    return (
      <section className="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/60 p-8 text-center shadow-lg shadow-slate-950/40">
        <h2 className="text-2xl font-semibold text-slate-100">历史行程</h2>
        <p className="mt-3 text-sm text-slate-400">登录后即可同步并管理你生成的所有行程计划。</p>
      </section>
    );
  }

  const applyExpenseDelta = (delta: number) => {
    setSelectedTrip((prev) => {
      if (!prev) {
        return prev;
      }

      const newTotal = (prev.total_expenses ?? 0) + delta;
      const derivedRemaining =
        prev.remaining_budget != null
          ? prev.remaining_budget - delta
          : prev.total_budget != null
            ? prev.total_budget - newTotal
            : null;

      return {
        ...prev,
        total_expenses: newTotal,
        remaining_budget: derivedRemaining
      };
    });
  };

  const handleExpenseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTrip || !userId) {
      setExpenseError("请先登录并选择行程。");
      return;
    }

    const amountValue = Number(draft.amount);
    if (Number.isNaN(amountValue) || amountValue < 0) {
      setExpenseError("请输入有效的金额。");
      return;
    }

    const payload = {
      userId,
      tripId: selectedTrip.id,
      category: draft.category || "其他",
      amount: amountValue,
      currency: draft.currency || "CNY",
      occurredOn: draft.occurredOn || null
    };

    try {
      const response = await axios.post<ExpenseItem>("/api/expenses", payload);
      setExpenses((prev) => [response.data, ...prev]);
      setDraft((prev) => ({ ...prev, amount: "", occurredOn: "" }));
      setExpenseError(null);
      applyExpenseDelta(response.data.amount);
    } catch (err) {
      console.error(err);
      setExpenseError("新增费用失败，请稍后重试。");
    }
  };

  const handleStartEdit = (expense: ExpenseItem) => {
    setEditingExpenseId(expense.id);
    setEditDraft({
      category: expense.category,
      amount: expense.amount.toString(),
      currency: expense.currency,
      occurredOn: expense.occurredOn ?? expense.occurred_on ?? ""
    });
  };

  const resetEditState = () => {
    setEditingExpenseId(null);
    setEditDraft(null);
  };

  const handleExpenseUpdate = async (
    event: FormEvent<HTMLFormElement>,
    expense: ExpenseItem
  ) => {
    event.preventDefault();
    if (!userId || !editDraft) {
      setExpenseError("请先选择要编辑的费用。");
      return;
    }

    const amountValue = Number(editDraft.amount);
    if (Number.isNaN(amountValue) || amountValue < 0) {
      setExpenseError("请输入有效的金额。");
      return;
    }

    const payload = {
      userId,
      expenseId: expense.id,
      category: editDraft.category || "其他",
      amount: amountValue,
      currency: editDraft.currency || "CNY",
      occurredOn: editDraft.occurredOn || null
    };

    try {
      const response = await axios.patch<ExpenseItem>("/api/expenses", payload);
      const updated = response.data;
      setExpenses((prev) =>
        prev.map((item) => (item.id === expense.id ? updated : item))
      );
      applyExpenseDelta(updated.amount - expense.amount);
      resetEditState();
      setExpenseError(null);
    } catch (err) {
      console.error(err);
      setExpenseError("更新费用失败，请稍后再试。");
    }
  };

  const handleExpenseDelete = async (expense: ExpenseItem) => {
    if (!userId) {
      setExpenseError("请先登录后再尝试删除。");
      return;
    }

    try {
      await axios.delete("/api/expenses", {
        params: {
          userId,
          expenseId: expense.id
        }
      });
      setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
      applyExpenseDelta(-expense.amount);
      if (editingExpenseId === expense.id) {
        resetEditState();
      }
      setExpenseError(null);
    } catch (err) {
      console.error(err);
      setExpenseError("删除费用失败，请稍后再试。");
    }
  };

  return (
    <section className="card card--muted">
      <div className="history-shell">
  <aside className="summary-box">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">历史行程</h2>
            {loading ? <span className="text-[11px] text-slate-500">加载中...</span> : null}
          </div>
          {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
          {!error && trips.length === 0 && !loading ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-700/70 bg-slate-900/80 p-4 text-xs text-slate-400">
              暂时没有历史行程，生成的行程会自动显示在这里。
            </p>
          ) : null}

          <ul className="history-list mt-4">
            {trips.map((trip) => {
              const isActive = trip.id === selectedTripId;
              return (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => handleViewDetail(trip)}
                    className={clsx("history-item", isActive && "is-active")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold line-clamp-1">{trip.title}</h3>
                      <span className="text-[10px] text-slate-400">
                        {new Date(trip.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                      {trip.intent}
                    </p>
                    {trip.total_budget != null ? (
                      <p className="mt-2 text-[11px] text-slate-400">
                        预算：{trip.total_budget} {trip.currency ?? "CNY"}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="relative flex flex-col gap-6">
          {selectedTrip ? (
            <>
              <div className="summary-box">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">行程详情</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-100">{selectedTrip.title}</h3>
                    <p className="mt-2 text-xs text-slate-400">
                      创建于 {new Date(selectedTrip.created_at).toLocaleString("zh-CN", { hour12: false })}
                    </p>
                    {selectedTrip.updated_at ? (
                      <p className="text-xs text-slate-400">
                        更新于 {new Date(selectedTrip.updated_at).toLocaleString("zh-CN", { hour12: false })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrip(null);
                      setDetailError(null);
                      setExpenses([]);
                      setExpenseError(null);
                      resetEditState();
                    }}
                    className="self-start rounded-full border border-slate-700/60 px-4 py-1 text-xs text-slate-300 transition hover:border-brand-400/60 hover:text-brand-200"
                  >
                    收起
                  </button>
                </div>

                <div className="detail-cards mt-6">
                  {selectedTrip.total_budget != null ? (
                    <div className="detail-metrics">
                      <p className="text-xs text-slate-400">总预算</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {selectedTrip.total_budget} {selectedTrip.currency ?? "CNY"}
                      </p>
                    </div>
                  ) : null}
                  <div className="detail-metrics">
                    <p className="text-xs text-slate-400">已花费</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedTrip.total_expenses ?? 0}
                    </p>
                  </div>
                  <div className="detail-metrics">
                    <p className="text-xs text-slate-400">剩余预算</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">
                      {selectedTrip.remaining_budget ?? "—"}
                    </p>
                  </div>
                </div>

                {selectedTrip.budget_breakdown && selectedTrip.budget_breakdown.length > 0 ? (
                  <div className="summary-box mt-6">
                    <p className="text-xs text-slate-400">预算拆分</p>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedTrip.budget_breakdown.map((item, index) => (
                        <li
                          key={`${item.category ?? "未知"}-${index}`}
                          className="flex items-center justify-between rounded-xl bg-slate-950/80 px-3 py-2 text-xs text-slate-300"
                        >
                          <span>{(item.category ?? "未知").trim() || "未知"}</span>
                          <span>{item.amount ?? 0}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="summary-box">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-100">AI 行程摘要</h4>
                    {detailLoading ? <p className="text-xs text-slate-400">详情加载中...</p> : null}
                    {detailError ? <p className="text-xs text-red-300">{detailError}</p> : null}
                  </div>
                </div>
                {!detailLoading && !detailError ? (
                  <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800/50 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-200">
                    {selectedTrip.generated_itinerary ?? "暂无行程详情"}
                  </pre>
                ) : null}
              </div>

              <div className="summary-box">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-lg font-semibold text-slate-100">费用记录</h4>
                  {expensesLoading ? <p className="text-xs text-slate-400">费用加载中...</p> : null}
                  {expenseError ? <p className="text-xs text-red-300">{expenseError}</p> : null}
                </div>

                <form onSubmit={handleExpenseSubmit} className="expense-form-grid mt-4">
                  <input
                    type="text"
                    value={draft.category}
                    onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
                    className="border border-slate-700/70 bg-slate-950/80 p-3 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="分类"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.amount}
                    onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
                    className="border border-slate-700/70 bg-slate-950/80 p-3 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="金额"
                  />
                  <input
                    type="text"
                    value={draft.currency}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase().slice(0, 3) }))
                    }
                    className="border border-slate-700/70 bg-slate-950/80 p-3 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="币种"
                  />
                  <input
                    type="date"
                    value={draft.occurredOn}
                    onChange={(event) => setDraft((prev) => ({ ...prev, occurredOn: event.target.value }))}
                    className="border border-slate-700/70 bg-slate-950/80 p-3 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow transition hover:-translate-y-0.5 hover:bg-brand-400"
                  >
                    新增
                  </button>
                </form>

                <ul className="expense-list mt-4">
                  {expenses.map((expense) => {
                    const occurredDate = expense.occurredOn ?? expense.occurred_on ?? null;
                    const displayDate = occurredDate
                      ? new Date(occurredDate).toLocaleDateString("zh-CN")
                      : new Date(expense.created_at).toLocaleDateString("zh-CN");

                    if (editingExpenseId === expense.id && editDraft) {
                      return (
                        <li
                          key={expense.id}
                          className="expense-card border-brand-400/60 bg-brand-400/15 text-xs text-slate-100"
                        >
                          <form
                            onSubmit={(event) => handleExpenseUpdate(event, expense)}
                            className="expense-form-grid"
                          >
                            <input
                              type="text"
                              value={editDraft.category}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? { ...prev, category: event.target.value }
                                    : null
                                )
                              }
                              className="rounded-xl border border-slate-200/40 bg-slate-950/30 p-3 text-xs text-slate-100 focus:border-brand-200 focus:outline-none focus:ring-1 focus:ring-brand-200"
                              placeholder="分类"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editDraft.amount}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? { ...prev, amount: event.target.value }
                                    : null
                                )
                              }
                              className="rounded-xl border border-slate-200/40 bg-slate-950/30 p-3 text-xs text-slate-100 focus:border-brand-200 focus:outline-none focus:ring-1 focus:ring-brand-200"
                              placeholder="金额"
                            />
                            <input
                              type="text"
                              value={editDraft.currency}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        currency: event.target.value.toUpperCase().slice(0, 3)
                                      }
                                    : null
                                )
                              }
                              className="rounded-xl border border-slate-200/40 bg-slate-950/30 p-3 text-xs text-slate-100 focus:border-brand-200 focus:outline-none focus:ring-1 focus:ring-brand-200"
                              placeholder="币种"
                            />
                            <input
                              type="date"
                              value={editDraft.occurredOn}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? { ...prev, occurredOn: event.target.value }
                                    : null
                                )
                              }
                              className="rounded-xl border border-slate-200/40 bg-slate-950/30 p-3 text-xs text-slate-100 focus:border-brand-200 focus:outline-none focus:ring-1 focus:ring-brand-200"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={resetEditState}
                                className="rounded-full border border-slate-200/60 px-4 py-2 text-xs text-slate-100 hover:border-white/80"
                              >
                                取消
                              </button>
                            </div>
                          </form>
                        </li>
                      );
                    }

                    return (
                      <li key={expense.id} className="expense-card">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{expense.category}</p>
                          <p className="text-slate-400">
                            {expense.amount} {expense.currency}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-slate-400">
                          <span>{displayDate}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(expense)}
                            className="rounded-full px-3 py-1 text-[11px] text-brand-300 transition hover:bg-brand-400/10"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExpenseDelete(expense)}
                            className="rounded-full px-3 py-1 text-[11px] text-red-300 transition hover:bg-red-500/10"
                          >
                            删除
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/60 bg-slate-950/50 p-10 text-center text-sm text-slate-400">
              <p>点击左侧行程即可查看详情、预算以及对应的费用记录。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
