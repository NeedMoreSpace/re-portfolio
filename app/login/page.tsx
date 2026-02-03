"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setErr(null);
    setSent(false);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });

    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Login</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>Пришлю magic link на email.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          marginTop: 12,
          outline: "none",
        }}
      />

      <button
        onClick={signIn}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #111827",
          background: "#111827",
          color: "white",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Send magic link
      </button>

      {sent && <p style={{ marginTop: 12 }}>✅ Проверь почту и нажми ссылку.</p>}
      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
    </main>
  );
}
