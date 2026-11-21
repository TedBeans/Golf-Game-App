"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/** Rounds are only stored for signed-in crew members. Without Supabase keys the app stays local-only. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, recovery } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const target =
    status === "anon" && path !== "/login" ? "/login" :
    status === "nocrew" && path !== "/crew" ? "/crew" :
    status === "ready" && path === "/login" && !recovery ? "/" : null;
  useEffect(() => { if (target) router.replace(target); }, [target, router]);
  if (status === "loading" || target) return <div className="empty">Loading…</div>;
  return <>{children}</>;
}
