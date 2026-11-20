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


export type PickOption = { value: string; label: string; meta?: string; sub?: string; dot?: string; group?: string };

/** Themed replacement for <select>: a trigger plus a bottom sheet. */
export function Picker({ value, options, onChange, placeholder = "Choose", title, compact = false }: {
  value: string; options: PickOption[]; onChange: (v: string) => void; placeholder?: string; title?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);
  const cur = options.find((o) => o.value === value);
  let lastGroup: string | undefined;
  return (
    <>
      <button type="button" className={"picker" + (compact ? " compact" : "") + (cur ? "" : " empty")} onClick={() => setOpen(true)} aria-haspopup="listbox" aria-expanded={open}>
        {cur?.dot && <i className="pdot" style={{ background: cur.dot }} />}
        <span className="plabel">{cur ? cur.label : placeholder}</span>
        {cur?.meta && !compact && <span className="pmeta">{cur.meta}</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="sheet-wrap" onClick={() => setOpen(false)}>
          <div className="sheet" role="listbox" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            {title && <div className="sheet-title">{title}</div>}
            <div className="sheet-list">
              {options.map((o) => {
                const head = o.group !== lastGroup && o.group ? o.group : null;
                lastGroup = o.group;
                return (
                  <div key={o.value}>
                    {head && <div className="sheet-group">{head}</div>}
                    <button type="button" role="option" aria-selected={o.value === value} className={"opt" + (o.value === value ? " on" : "")} onClick={() => { onChange(o.value); setOpen(false); }}>
                      {o.dot !== undefined && <i className="pdot" style={{ background: o.dot }} />}
                      <span className="grow"><span className="olabel">{o.label}</span>{o.sub && <span className="osub">{o.sub}</span>}</span>
                      {o.meta && <span className="ometa">{o.meta}</span>}
                      <svg className="ocheck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/** Themed confirmation sheet (replaces window.confirm). */
export function ConfirmSheet({ open, title, body, confirmLabel = "Delete", danger = true, onConfirm, onClose }: {
  open: boolean; title: string; body?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()} style={{ padding: "8px 16px calc(16px + env(safe-area-inset-bottom))" }}>
        <div className="sheet-grip" />
        <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-.02em", margin: "6px 0 6px" }}>{title}</div>
        {body && <div className="sub" style={{ marginBottom: 18 }}>{body}</div>}
        <div className="stack8">
          <button className={"btn" + (danger ? " delete" : "")} style={{ width: "100%" }} onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn ghost" style={{ width: "100%" }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
