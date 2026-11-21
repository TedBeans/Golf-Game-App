"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { signIn, signUp, resetPassword, setNewPassword, recovery } = useAuth();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const submit = async () => {
    setErr(""); setNote(""); setBusy(true);
    try {
      if (recovery) { const e = await setNewPassword(pw); if (e) setErr(e); return; }
      if (mode === "in") { const e = await signIn(email, pw); if (e) setErr(e); }
      else if (mode === "up") {
        const r = await signUp(email, pw, name || email.split("@")[0]);
        if (r.error) setErr(r.error); else if (r.needsConfirm) setNote("Check your email for a confirmation link, then come back and sign in.");
      } else { const e = await resetPassword(email); if (e) setErr(e); else setNote("If that email has an account, a reset link is on its way."); }
    } finally { setBusy(false); }
  };
  const ok = recovery ? pw.length >= 6 : mode === "reset" ? /\S+@\S+/.test(email) : /\S+@\S+/.test(email) && pw.length >= 6 && (mode === "in" || name.trim().length > 0);

  return (
    <>
      <div className="top"><span className="brand">PRESS<i>.</i></span></div>
      <h1 className="title">{recovery ? "New password" : mode === "up" ? "Create your account" : mode === "reset" ? "Reset password" : "Welcome back"}</h1>
      <p className="sub" style={{ margin: "10px 0 22px" }}>{recovery ? "Pick a new password for your account." : mode === "up" ? "Rounds, players and balances are saved to your crew, so you never lose them." : mode === "reset" ? "We'll email you a link to set a new one." : "Sign in to see your rounds and balances."}</p>

      <div className="card stack">
        {mode === "up" && !recovery && (
          <label className="field"><span className="label">Your name</span><input className="input" autoComplete="name" placeholder="What your friends call you" value={name} onChange={(e) => setName(e.target.value)} /></label>
        )}
        {!recovery && (
          <label className="field"><span className="label">Email</span><input className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        )}
        {mode !== "reset" && (
          <label className="field"><span className="label">{recovery ? "New password" : "Password"}</span><input className="input" type="password" autoComplete={mode === "up" || recovery ? "new-password" : "current-password"} placeholder="At least 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok && !busy && submit()} /></label>
        )}
        {err && <div className="small" style={{ color: "var(--loss)" }}>{err}</div>}
        {note && <div className="small" style={{ color: "var(--gain)" }}>{note}</div>}
        <button className="btn block" disabled={!ok || busy} onClick={submit} style={{ padding: 16 }}>
          {busy ? "One sec…" : recovery ? "Save password" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </button>
      </div>

      {!recovery && (
        <div className="stack8" style={{ marginTop: 16, textAlign: "center" }}>
          {mode === "in" && <>
            <button className="btn quiet" onClick={() => { setMode("up"); setErr(""); setNote(""); }}>New here? Create an account</button>
            <button className="btn quiet" onClick={() => { setMode("reset"); setErr(""); setNote(""); }}>Forgot password?</button>
          </>}
          {mode !== "in" && <button className="btn quiet" onClick={() => { setMode("in"); setErr(""); setNote(""); }}>Back to sign in</button>}
        </div>
      )}
    </>
  );
}
