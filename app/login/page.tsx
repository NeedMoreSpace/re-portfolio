"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { supabase } from "@/lib/supabaseClient";

type Property = {
  id: string;
  name: string;
  type: "apartment" | "house";
  city?: string | null;
  valueCZK: number;
  debtCZK: number;
  rentCZK: number;
  mortgagePaymentCZK: number;
};

type NetWorthPoint = {
  date: string; // YYYY-MM-DD
  equity: number;
};

const DEFAULT_PROPERTIES: Omit<Property, "id">[] = [
  { name: "Byt #1", type: "apartment", city: "Praha", valueCZK: 0, debtCZK: 0, rentCZK: 0, mortgagePaymentCZK: 0 },
  { name: "Byt #2", type: "apartment", city: "Praha", valueCZK: 0, debtCZK: 0, rentCZK: 0, mortgagePaymentCZK: 0 },
  { name: "Byt #3", type: "apartment", city: "Praha", valueCZK: 0, debtCZK: 0, rentCZK: 0, mortgagePaymentCZK: 0 },
  { name: "Dům",   type: "house",     city: null,   valueCZK: 0, debtCZK: 0, rentCZK: 0, mortgagePaymentCZK: 0 },
];

function formatCZK(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseNumber(input: string): number {
  const cleaned = input.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type DraftRow = { valueCZK: string; debtCZK: string; rentCZK: string; mortgagePaymentCZK: string };

export default function Dashboard() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [history, setHistory] = useState<NetWorthPoint[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const [draft, setDraft] = useState<DraftRow[]>(() =>
    DEFAULT_PROPERTIES.map(() => ({
      valueCZK: "0",
      debtCZK: "0",
      rentCZK: "0",
      mortgagePaymentCZK: "0",
    }))
  );

  // ---------- AUTH ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      setUserEmail(session?.user?.email ?? null);
      setAuthReady(true);
      if (!uid) router.replace("/login");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      setUserEmail(session?.user?.email ?? null);
      setAuthReady(true);
      if (!uid) router.replace("/login");
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ---------- LOAD DATA ----------
  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoadingData(true);

      // 1) properties
      const { data: propsRows, error: propsErr } = await supabase
        .from("properties")
        .select("id,name,type,city,value_czk,debt_czk,rent_czk,mortgage_payment_czk")
        .order("created_at", { ascending: true });

      if (propsErr) {
        console.error(propsErr);
      }

      let props: Property[] = (propsRows ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        city: r.city,
        valueCZK: Number(r.value_czk) || 0,
        debtCZK: Number(r.debt_czk) || 0,
        rentCZK: Number(r.rent_czk) || 0,
        mortgagePaymentCZK: Number(r.mortgage_payment_czk) || 0,
      }));

      // если у юзера пока вообще нет объектов — создадим 4 дефолтных в базе
      if (props.length === 0) {
        const inserts = DEFAULT_PROPERTIES.map((p) => ({
          user_id: userId,
          name: p.name,
          type: p.type,
          city: p.city ?? null,
          value_czk: p.valueCZK,
          debt_czk: p.debtCZK,
          rent_czk: p.rentCZK,
          mortgage_payment_czk: p.mortgagePaymentCZK,
        }));

        const { data: inserted, error: insErr } = await supabase
          .from("properties")
          .insert(inserts)
          .select("id,name,type,city,value_czk,debt_czk,rent_czk,mortgage_payment_czk")
          .order("created_at", { ascending: true });

        if (insErr) {
          console.error(insErr);
        } else {
          props = (inserted ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            city: r.city,
            valueCZK: Number(r.value_czk) || 0,
            debtCZK: Number(r.debt_czk) || 0,
            rentCZK: Number(r.rent_czk) || 0,
            mortgagePaymentCZK: Number(r.mortgage_payment_czk) || 0,
          }));
        }
      }

      setProperties(props);
      setDraft(
        props.map((p) => ({
          valueCZK: String(p.valueCZK),
          debtCZK: String(p.debtCZK),
          rentCZK: String(p.rentCZK),
          mortgagePaymentCZK: String(p.mortgagePaymentCZK),
        }))
      );

      // 2) history
      const { data: histRows, error: histErr } = await supabase
        .from("networth_points")
        .select("date,equity_czk")
        .order("date", { ascending: true });

      if (histErr) {
        console.error(histErr);
      }

      const hist: NetWorthPoint[] = (histRows ?? []).map((r: any) => ({
        date: String(r.date),
        equity: Number(r.equity_czk) || 0,
      }));

      setHistory(hist);
      setLoadingData(false);
    })();
  }, [userId]);

  const totals = useMemo(() => {
    const totalValue = properties.reduce((s, p) => s + p.valueCZK, 0);
    const totalDebt = properties.reduce((s, p) => s + p.debtCZK, 0);
    const totalEquity = totalValue - totalDebt;

    const totalRent = properties.reduce((s, p) => s + (p.rentCZK ?? 0), 0);
    const totalMortgage = properties.reduce((s, p) => s + (p.mortgagePaymentCZK ?? 0), 0);
    const netCashflow = totalRent - totalMortgage;

    return { totalValue, totalDebt, totalEquity, totalRent, totalMortgage, netCashflow };
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

  async function upsertTodayPoint(equity: number) {
    const d = todayISO();

    const { error } = await supabase.from("networth_points").upsert(
      { user_id: userId!, date: d, equity_czk: equity },
      { onConflict: "user_id,date" }
    );

    if (error) {
      console.error(error);
      return;
    }

    // refresh history (cheap)
    const { data: histRows } = await supabase
      .from("networth_points")
      .select("date,equity_czk")
      .order("date", { ascending: true });

    const hist: NetWorthPoint[] = (histRows ?? []).map((r: any) => ({
      date: String(r.date),
      equity: Number(r.equity_czk) || 0,
    }));
    setHistory(hist);
  }

  async function saveEditor() {
    // apply draft to local state
    const next = properties.map((p, i) => ({
      ...p,
      valueCZK: parseNumber(draft[i]?.valueCZK ?? "0"),
      debtCZK: parseNumber(draft[i]?.debtCZK ?? "0"),
      rentCZK: parseNumber(draft[i]?.rentCZK ?? "0"),
      mortgagePaymentCZK: parseNumber(draft[i]?.mortgagePaymentCZK ?? "0"),
    }));

    setProperties(next);

    // upsert properties
    const payload = next.map((p) => ({
      id: p.id,
      user_id: userId!,
      name: p.name,
      type: p.type,
      city: p.city ?? null,
      value_czk: p.valueCZK,
      debt_czk: p.debtCZK,
      rent_czk: p.rentCZK,
      mortgage_payment_czk: p.mortgagePaymentCZK,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("properties").upsert(payload);

    if (error) {
      console.error(error);
      alert("Save failed. Check console.");
      return;
    }

    const equityTotal = next.reduce((s, p) => s + (p.valueCZK - p.debtCZK), 0);
    await upsertTodayPoint(equityTotal);

    setIsEditing(false);
  }

  if (!authReady) {
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading auth…</div>;
}

if (!userId) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      Not logged in. Go to <a href="/login">/login</a>
    </div>
  );
}



  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Real Estate Portfolio (CZ)</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Supabase version: login + cloud storage (value/debt/rent/mortgage + equity history)
          </p>
          {userEmail && (
            <p style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Logged in as <b>{userEmail}</b>
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openEditor} style={btnStylePrimary} disabled={loadingData}>
            Edit portfolio
          </button>
          <button onClick={signOut} style={btnStyle}>
            Logout
          </button>
        </div>
      </header>

      {loadingData ? (
        <div style={{ marginTop: 18, opacity: 0.75 }}>Loading data…</div>
      ) : (
        <>
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
            <Card title="Total Equity (Value − Debt)" value={formatCZK(totals.totalEquity)} />
            <Card title="Monthly Rent (gross)" value={formatCZK(totals.totalRent)} />
            <Card title="Monthly Mortgage (payments)" value={formatCZK(totals.totalMortgage)} />
            <Card title="Net Monthly Cashflow" value={formatCZK(totals.netCashflow)} />
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Net Worth History (Equity)</h2>

            {history.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                Нет данных. Нажми <b>Edit portfolio → Save</b>, чтобы зафиксировать первую точку.
              </div>
            ) : (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={history}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                      />
                      <Tooltip
                        formatter={(v: any) => formatCZK(typeof v === "number" ? v : Number(v))}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line type="monotone" dataKey="equity" stroke="#111827" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Objects</h2>

            <div style={{ display: "grid", gap: 10 }}>
              {properties.map((p) => {
                const equity = p.valueCZK - p.debtCZK;
                const cashflow = (p.rentCZK ?? 0) - (p.mortgagePaymentCZK ?? 0);

                return (
                  <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{p.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {p.type} · {p.city ?? "—"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Equity</div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{formatCZK(equity)}</div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Cashflow / month</div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{formatCZK(cashflow)}</div>
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
                      <Mini title="Mortgage / month" value={formatCZK(p.mortgagePaymentCZK)} />
                      <Mini title="Cashflow / month" value={formatCZK(cashflow)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {isEditing && (
        <Modal title="Edit portfolio" onClose={cancelEditor}>
          <p style={{ marginTop: 0, opacity: 0.75 }}>
            Вводи числа как хочешь: <b>7450000</b> или <b>7 450 000</b> — я сам пойму.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {properties.map((p, i) => (
              <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  {p.name} <span style={{ opacity: 0.6, fontWeight: 700 }}>({p.type})</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                  <Field
                    label="Value (CZK)"
                    value={draft[i]?.valueCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, valueCZK: v } : x)))
                    }
                  />
                  <Field
                    label="Debt (CZK)"
                    value={draft[i]?.debtCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, debtCZK: v } : x)))
                    }
                  />
                  <Field
                    label="Rent / month (CZK)"
                    value={draft[i]?.rentCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, rentCZK: v } : x)))
                    }
                  />
                  <Field
                    label="Mortgage payment / month (CZK)"
                    value={draft[i]?.mortgagePaymentCZK ?? "0"}
                    onChange={(v) =>
                      setDraft((d) =>
                        d.map((x, idx) => (idx === i ? { ...x, mortgagePaymentCZK: v } : x))
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
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
/ /   r e d e p l o y  
 