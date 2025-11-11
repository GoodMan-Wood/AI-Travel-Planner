"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";

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
}

export function TripHistory({ userId }: TripHistoryProps) {
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
      } catch (err) {
        console.error(err);
        setError("暂时无法获取行程历史。");
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [userId]);

  if (!userId) {
    return null;
  }

  const handleViewDetail = async (trip: TripSummary) => {
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
  };

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
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">历史行程</h2>
        {loading ? <span className="text-xs text-slate-500">加载中...</span> : null}
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {!error && trips.length === 0 && !loading ? (
        <p className="mt-3 text-sm text-slate-400">暂时没有历史行程。</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {trips.map((trip) => (
          <li key={trip.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">{trip.title}</h3>
              <span className="text-xs text-slate-500">
                {new Date(trip.created_at).toLocaleString("zh-CN", {
                  hour12: false
                })}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
              {trip.intent}
            </p>
            {trip.total_budget != null ? (
              <p className="mt-2 text-xs text-slate-300">
                预算：{trip.total_budget} {trip.currency ?? "CNY"}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => handleViewDetail(trip)}
              className="mt-3 text-xs font-semibold text-brand-300 underline"
            >
              查看详情
            </button>
          </li>
        ))}
      </ul>

      {selectedTrip ? (
        <div className="mt-6 space-y-3 rounded-md border border-brand-500/40 bg-slate-950/60 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-brand-200">{selectedTrip.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                创建于：
                {new Date(selectedTrip.created_at).toLocaleString("zh-CN", { hour12: false })}
              </p>
              {selectedTrip.updated_at ? (
                <p className="text-xs text-slate-500">
                  更新于：
                  {new Date(selectedTrip.updated_at).toLocaleString("zh-CN", { hour12: false })}
                </p>
              ) : null}
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {selectedTrip.total_budget != null ? (
                  <p>
                    总预算：{selectedTrip.total_budget} {selectedTrip.currency ?? "CNY"}
                  </p>
                ) : null}
                {selectedTrip.total_expenses != null ? (
                  <p>已花费：{selectedTrip.total_expenses}</p>
                ) : null}
                {selectedTrip.remaining_budget != null ? (
                  <p>剩余预算：{selectedTrip.remaining_budget}</p>
                ) : null}
              </div>
              {selectedTrip.budget_breakdown && selectedTrip.budget_breakdown.length > 0 ? (
                <div className="mt-3 text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">预算拆分</p>
                  <ul className="mt-1 space-y-1">
                    {selectedTrip.budget_breakdown.map((item, index) => (
                      <li key={`${item.category ?? "未知"}-${index}`}>
                        {(item.category ?? "未知").trim() || "未知"}：{item.amount ?? 0}
                      </li>
                    ))}
                  </ul>
                </div>
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
              className="text-xs text-slate-400 underline"
            >
              收起
            </button>
          </div>
          {detailLoading ? <p className="text-xs text-slate-400">详情加载中...</p> : null}
          {detailError ? <p className="text-xs text-red-300">{detailError}</p> : null}
          {!detailLoading && !detailError ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-200">
              {selectedTrip.generated_itinerary ?? "暂无行程详情"}
            </pre>
          ) : null}

          <div className="mt-4 space-y-2">
            <h4 className="text-lg font-semibold text-brand-200">费用记录</h4>
            {expensesLoading ? <p className="text-xs text-slate-400">费用加载中...</p> : null}
            {expenseError ? <p className="text-xs text-red-300">{expenseError}</p> : null}

            <form onSubmit={handleExpenseSubmit} className="grid gap-2 md:grid-cols-5">
              <input
                type="text"
                value={draft.category}
                onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
                className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder="分类"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
                className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder="金额"
              />
              <input
                type="text"
                value={draft.currency}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase().slice(0, 3) }))
                }
                className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder="币种"
              />
              <input
                type="date"
                value={draft.occurredOn}
                onChange={(event) => setDraft((prev) => ({ ...prev, occurredOn: event.target.value }))}
                className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <button
                type="submit"
                className="rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-400"
              >
                新增
              </button>
            </form>

            <ul className="space-y-2">
              {expenses.map((expense) => {
                const occurredDate = expense.occurredOn ?? expense.occurred_on ?? null;
                const displayDate = occurredDate
                  ? new Date(occurredDate).toLocaleDateString("zh-CN")
                  : new Date(expense.created_at).toLocaleDateString("zh-CN");

                if (editingExpenseId === expense.id && editDraft) {
                  return (
                    <li
                      key={expense.id}
                      className="rounded-md border border-brand-500/40 bg-slate-900/60 p-3 text-xs text-slate-200"
                    >
                      <form
                        onSubmit={(event) => handleExpenseUpdate(event, expense)}
                        className="grid gap-2 md:grid-cols-5"
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
                          className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                          className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                          className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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
                          className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-xs text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-400"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={resetEditState}
                            className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    </li>
                  );
                }

                return (
                  <li
                    key={expense.id}
                    className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-200 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{expense.category}</p>
                      <p className="text-slate-400">
                        {expense.amount} {expense.currency}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{displayDate}</span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(expense)}
                        className="text-brand-300 hover:underline"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExpenseDelete(expense)}
                        className="text-red-300 hover:underline"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
