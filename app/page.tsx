"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Property = {
  id: string;
  name: string;
  type: "apartment" | "house";
  city?: string;
  valueCZK: number;
  debtCZK: number;
  rentCZK: number;
  mortgagePaymentCZK: number;
};

type NetWorthPoint = {
  date: string; // YYYY-MM-DD
  equity: number;
};

const STORAGE_KEY = "re_portfolio_v1";
const HISTORY_KEY = "re_portfolio_history_v1";

const DEFAULT_PROPERTIES: Property[] = [
  {
    id: "1",
    name: "Byt #1",
    type: "apartment",
    city: "Praha",
    valueCZK: 0,
    debtCZK: 0,
    rentCZK: 0,
    mortgagePaymentCZK: 0,
  },
  {
    id: "2",
    name: "Byt #2",
    type: "apartment",
    city: "Praha",
    valueCZK: 0,
    debtCZK: 0,
    rentCZK: 0,
    mortgagePaymentCZK: 0,
  },
  {
    id: "3",
    name: "Byt #3",
    type: "apartment",
    city: "Praha",
    valueCZK: 0,
    debtCZK: 0,
    rentCZK: 0,
    mortgagePaymentCZK: 0,
  },
  {
    id: "4",
    name: "Dům",
    type: "house",
    city: "—",
    valueCZK: 0,
    debtCZK: 0,
    rentCZK: 0,
    mortgagePaymentCZK: 0,
  },
];

function formatCZK(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseNumber(input: string): number {
  // поддержим "7 450 000" или "7,450,000" — выкинем всё кроме цифр
  const cleaned = input.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadFromStorage(): Property[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return null;

    // мержим с дефолтом + защитимся от старых данных
    return DEFAULT_PROPERTIES.map((def, idx) => {
      const p = parsed[idx] ?? {};
      return {
        ...def,
        ...p,
        valueCZK: Number(p.valueCZK) || 0,
        debtCZK: Number(p.debtCZK) || 0,
        rentCZK: Number(p.rentCZK) || 0,
        mortgagePaymentCZK: Number(p.mortgagePaymentCZK) || 0,
      };
    });
  } catch {
    return null;
  }
}

function saveToStorage(props: Property[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(props));
}

function loadHistory(): NetWorthPoint[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NetWorthPoint[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(points: NetWorthPoint[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(points));
}

function clampHistory(points: NetWorthPoint[], maxPoints = 3650) {
  // чтобы localStorage не разрастался бесконечно (10 лет дневных точек)
  if (points.length <= maxPoints) return points;
  return points.slice(points.length - maxPoints);
}

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>(DEFAULT_PROPERTIES);
  const [history, setHistory] = useState<NetWorthPoint[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // отдельное состояние для формы (строки, чтобы удобно вводить)
  const [draft, setDraft] = useState<
    Array<{
      valueCZK: string;
      debtCZK: string;
      rentCZK: string;
      mortgagePaymentCZK: string;
    }>
  >(() =>
    DEFAULT_PROPERTIES.map(() => ({
      valueCZK: "0",
      debtCZK: "0",
      rentCZK: "0",
      mortgagePaymentCZK: "0",
    }))
  );

  useEffect(() => {
    const loaded = loadFromStorage();
    if (loaded) {
      setProperties(loaded);
      setDraft(
        loaded.map((p) => ({
          valueCZK: String(p.valueCZK),
          debtCZK: String(p.debtCZK),
          rentCZK: String(p.rentCZK),
          mortgagePaymentCZK: String(p.mortgagePaymentCZK),
        }))
      );
    }
    setHistory(loadHistory());
  }, []);

  const totals = useMemo(() => {
    const totalValue = properties.reduce((s, p) => s + p.valueCZK, 0);
    const totalDebt = properties.reduce((s, p) => s + p.debtCZK, 0);
    const totalEquity = totalValue - totalDebt;

    const totalRent = properties.reduce((s, p) => s + (p.rentCZK ?? 0), 0);
    const totalMortgage = properties.reduce(
      (s, p) => s + (p.mortgagePaymentCZK ?? 0),
      0
    );
    const netCashflow = totalRent - totalMortgage;

    return {
      totalValue,
      totalDebt,
      totalEquity,
      totalRent,
      totalMortgage,
      netCashflow,
    };
  }, [properties]);

  function openEditor() {
    setDraft(
      properties.map((p) => ({
        valueCZK: String(p.valueCZK),
        debtCZK: String(p.debtCZK),
        rentCZK: String(p.rentCZK),
        mortgagePaymentCZK: String(p.mortgagePaymentCZK),
      }))
    );
    setIsEditing(true);
  }

  function cancelEditor() {
    setIsEditing(false);
  }

  function upsertTodayPoint(equity: number) {
    const today = todayISO();
    const nextHistory = [
      ...history.filter((p) => p.date !== today),
      { date: today, equity },
    ].sort((a, b) => a.date.localeCompare(b.date));

    const clamped = clampHistory(nextHistory);
    setHistory(clamped);
    saveHistory(clamped);
  }

  function saveEditor() {
    const next = properties.map((p, i) => ({
      ...p,
      valueCZK: parseNumber(draft[i]?.valueCZK ?? "0"),
      debtCZK: parseNumber(draft[i]?.debtCZK ?? "0"),
      rentCZK: parseNumber(draft[i]?.rentCZK ?? "0"),
      mortgagePaymentCZK: parseNumber(draft[i]?.mortgagePaymentCZK ?? "0"),
    }));

    setProperties(next);
    saveToStorage(next);

    const equityTotal = next.reduce((s, p) => s + (p.valueCZK - p.debtCZK), 0);
    upsertTodayPoint(equityTotal);

    setIsEditing(false);
  }

  function resetAll() {
    setProperties(DEFAULT_PROPERTIES);
    setDraft(
      DEFAULT_PROPERTIES.map(() => ({
        valueCZK: "0",
        debtCZK: "0",
        rentCZK: "0",
        mortgagePaymentCZK: "0",
      }))
    );
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    setIsEditing(false);
  }

  const lastPoint = history.length ? history[history.length - 1] : null;

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>
            Real Estate Portfolio (CZ)
          </h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            MVP: value + debt + rent − mortgage → equity & cashflow (saved in
            your browser)
          </p>
          {lastPoint && (
            <p style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Last saved point: <b>{lastPoint.date}</b>
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openEditor} style={btnStylePrimary}>
            Edit portfolio
          </button>
          <button onClick={resetAll} style={btnStyle}>
            Reset
          </button>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginTop: 18,
        }}
      >
        <Card title="Total Property Value" value={formatCZK(totals.totalValue)} />
        <Card title="Total Debt" value={formatCZK(totals.totalDebt)} />
        <Card
          title="Total Equity (Value − Debt)"
          value={formatCZK(totals.totalEquity)}
        />
        <Card title="Monthly Rent (gross)" value={formatCZK(totals.totalRent)} />
        <Card
          title="Monthly Mortgage (payments)"
          value={formatCZK(totals.totalMortgage)}
        />
        <Card
          title="Net Monthly Cashflow"
          value={formatCZK(totals.netCashflow)}
        />
      </section>

      {/* GRAPH */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
          Net Worth History (Equity)
        </h2>

        {history.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            Нет данных. Нажми <b>Edit portfolio → Save</b>, чтобы зафиксировать
            первую точку.
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={history}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(v: any) =>
                      formatCZK(typeof v === "number" ? v : Number(v))
                    }
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#111827"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Совет: сохраняй раз в неделю (например по воскресеньям) — график
              станет очень наглядным.
            </div>
          </div>
        )}
      </section>

      {/* OBJECTS */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
          Objects
        </h2>

        <div style={{ display: "grid", gap: 10 }}>
          {properties.map((p) => {
            const equity = p.valueCZK - p.debtCZK;
            const cashflow = (p.rentCZK ?? 0) - (p.mortgagePaymentCZK ?? 0);

            return (
              <div
                key={p.id}
                style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {p.type} · {p.city ?? "—"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Equity</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
                      {formatCZK(equity)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      Cashflow / month
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                      {formatCZK(cashflow)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <Mini title="Value" value={formatCZK(p.valueCZK)} />
                  <Mini title="Debt" value={formatCZK(p.debtCZK)} />
                  <Mini title="Rent / month" value={formatCZK(p.rentCZK)} />
                  <Mini
                    title="Mortgage / month"
                    value={formatCZK(p.mortgagePaymentCZK)}
                  />
                  <Mini title="Cashflow / month" value={formatCZK(cashflow)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL */}
      {isEditing && (
        <Modal title="Edit portfolio" onClose={cancelEditor}>
          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Вводи числа как хочешь: <b>7450000</b> или <b>7 450 000</b> — я сам
            пойму.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {properties.map((p, i) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  {p.name}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 700 }}>
                    ({p.type})
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <Field
                    label="Value (CZK)"
                    value={draft[i]?.valueCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) =>
                        d.map((x, idx) => (idx === i ? { ...x, valueCZK: v } : x))
                      )
                    }
                  />
                  <Field
                    label="Debt (CZK)"
                    value={draft[i]?.debtCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) =>
                        d.map((x, idx) => (idx === i ? { ...x, debtCZK: v } : x))
                      )
                    }
                  />
                  <Field
                    label="Rent / month (CZK)"
                    value={draft[i]?.rentCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) =>
                        d.map((x, idx) => (idx === i ? { ...x, rentCZK: v } : x))
                      )
                    }
                  />
                  <Field
                    label="Mortgage payment / month (CZK)"
                    value={draft[i]?.mortgagePaymentCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) =>
                        d.map((x, idx) =>
                          idx === i ? { ...x, mortgagePaymentCZK: v } : x
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 14,
            }}
          >
            <button onClick={cancelEditor} style={btnStyle}>
              Cancel
            </button>
            <button onClick={saveEditor} style={btnStylePrimary}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Mini({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 14,
          outline: "none",
        }}
      />
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          background: "white",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
          <button onClick={onClose} style={btnStyle}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 800,
};

const btnStylePrimary: React.CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 900,
};
