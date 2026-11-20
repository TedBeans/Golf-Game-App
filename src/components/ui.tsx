"use client";
import { useEffect, useState, type ReactNode } from "react";
import { cents, money, signed } from "@/lib/money";

export const initials = (n: string) => n.trim().slice(0, 2).toUpperCase() || "?";
export const Avatar = ({ name }: { name: string }) => <span className="avatar">{initials(name)}</span>;

export function Net({ v, plus = true, className = "" }: { v: number; plus?: boolean; className?: string }) {
  const c = cents(v);
  return <span className={`${c > 0 ? "gain" : c < 0 ? "loss" : "even"} ${className}`}>{plus ? signed(v) : money(v)}</span>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label className="label">{label}</label>{children}</div>;
}

/** Number input that keeps what you type and commits valid numbers as you go. */
export function NumInput({ value, onChange, min, max, step = "any", prefix, className = "", placeholder }: {
  value: number | undefined; onChange: (n: number) => void; min?: number; max?: number; step?: string; prefix?: string; className?: string; placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? "" : String(value));
  useEffect(() => {
    setText((t) => (parseFloat(t) === value ? t : value === undefined || Number.isNaN(value) ? "" : String(value)));
  }, [value]);
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span className="faint" style={{ position: "absolute", left: 14, top: 12, pointerEvents: "none" }}>{prefix}</span>}
      <input
        className={`input ${className}`} style={prefix ? { paddingLeft: 26 } : undefined} inputMode="decimal" step={step} placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.\-]/g, "");
          setText(t);
          const n = parseFloat(t);
          if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
        onBlur={() => setText(value === undefined || Number.isNaN(value) ? "" : String(value))}
      />
    </div>
  );
}

const I = (d: string) => function Icon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
};
export const IconFlag = I("M5 21V4m0 0h11l-2 4 2 4H5");
export const IconCoin = I("M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v10m3-7.5c0-1-1.3-1.8-3-1.8s-3 .8-3 1.8 1.3 1.7 3 2.2 3 1.2 3 2.2-1.3 1.8-3 1.8-3-.8-3-1.8");
export const IconUsers = I("M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm11.5 9v-1a4 4 0 00-3-3.9M15 4.1a3.5 3.5 0 010 6.8");

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 1800); return () => clearTimeout(t); }, [msg]);
  return { show: setMsg, node: msg ? <div className="toast">{msg}</div> : null };
}
