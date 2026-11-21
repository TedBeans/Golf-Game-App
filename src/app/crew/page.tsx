"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

export default function CrewPage() {
  const router = useRouter();
  const { status, crew, members, user, displayName, createCrew, joinCrew, signOut } = useAuth();
  const { sync } = useStore();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [crewName, setCrewName] = useState("");
  const [code, setCode] = useState("");
  const [me, setMe] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  if (status === "local") return <div className="empty">Accounts aren't set up on this copy of the app yet.</div>;

  if (status === "nocrew") {
    const go = async () => {
      setErr(""); setBusy(true);
      const e = mode === "create" ? await createCrew(crewName, me) : await joinCrew(code, me);
      setBusy(false);
      if (e) setErr(e); else router.replace("/");
    };
    const ok = me.trim() && (mode === "create" ? crewName.trim() : code.trim().length >= 4);
    return (
      <>
        <div className="top"><span className="brand">PRESS<i>.</i></span><button className="btn quiet sm" onClick={signOut}>Sign out</button></div>
        <h1 className="title">Your crew</h1>
        <p className="sub" style={{ margin: "10px 0 22px" }}>A crew is the group you play with. Everyone in it sees the same rounds, scores and balances, live.</p>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={mode === "create" ? "on" : ""} onClick={() => { setMode("create"); setErr(""); }}>Start a crew</button>
          <button className={mode === "join" ? "on" : ""} onClick={() => { setMode("join"); setErr(""); }}>Join with a code</button>
        </div>
        <div className="card stack">
          <label className="field"><span className="label">Your name in the crew</span><input className="input" value={me} onChange={(e) => setMe(e.target.value)} /></label>
          {mode === "create"
            ? <label className="field"><span className="label">Crew name</span><input className="input" placeholder="Sunday Skins" value={crewName} onChange={(e) => setCrewName(e.target.value)} /></label>
            : <label className="field"><span className="label">Invite code</span><input className="input" autoCapitalize="characters" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: ".2em", fontWeight: 700 }} /></label>}
          {err && <div className="small" style={{ color: "var(--loss)" }}>{err}</div>}
          <button className="btn block" disabled={!ok || busy} onClick={go} style={{ padding: 16 }}>{busy ? "One sec…" : mode === "create" ? "Create crew" : "Join crew"}</button>
        </div>
      </>
    );
  }

  const share = async () => {
    const text = `Join my crew "${crew!.name}" on Press. Sign up at ${location.origin} and use invite code ${crew!.invite_code}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <>
      <div className="top"><button className="btn quiet sm" onClick={() => router.back()}>← Back</button></div>
      <h1 className="title">{crew?.name}</h1>
      <p className="sub" style={{ margin: "8px 0 18px" }}>
        {sync === "synced" ? "All rounds are saved to the cloud." : sync === "saving" ? "Saving…" : sync === "offline" ? "No signal. Changes are kept on this phone and will upload when you're back online." : "Saved on this phone."}
      </p>
      <div className="card">
        <div className="label">Invite code</div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: ".18em", margin: "4px 0 12px" }}>{crew?.invite_code}</div>
        <button className="btn block ghost" onClick={share}>{copied ? "Copied" : "Share invite"}</button>
      </div>
      <div className="h2">Members</div>
      <div className="card divide" style={{ padding: "4px 16px" }}>
        {members.map((m) => (
          <div key={m.user_id} className="prow"><b className="grow">{m.display_name}</b>{m.user_id === user?.id && <span className="faint small">you</span>}</div>
        ))}
      </div>
      <p className="small faint" style={{ margin: "12px 2px" }}>Signed in as {user?.email}</p>
      <button className="btn block danger" onClick={signOut}>Sign out</button>
    </>
  );
}
