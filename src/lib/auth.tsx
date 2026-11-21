"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { cloudEnabled, supabase } from "./supabase";

export type Crew = { id: string; name: string; invite_code: string };
export type Member = { user_id: string; display_name: string };
/** local = no Supabase keys, so the app just stores on this device */
export type AuthStatus = "local" | "loading" | "anon" | "nocrew" | "ready";

type Auth = {
  status: AuthStatus;
  user: User | null;
  crew: Crew | null;
  members: Member[];
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  setNewPassword: (password: string) => Promise<string | null>;
  createCrew: (name: string, display: string) => Promise<string | null>;
  joinCrew: (code: string, display: string) => Promise<string | null>;
  displayName: string;
};

const Ctx = createContext<Auth | null>(null);
const CREW_CACHE = "golf-game-app:crew";

const nice = (m: string) =>
  /invalid login/i.test(m) ? "Wrong email or password." :
  /already registered|already been registered/i.test(m) ? "That email already has an account. Try signing in." :
  /password should be at least/i.test(m) ? "Use a password with at least 6 characters." :
  /email not confirmed/i.test(m) ? "Check your email and tap the confirmation link first." :
  /rate limit/i.test(m) ? "Too many tries. Wait a minute and try again." : m;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [booted, setBooted] = useState(!cloudEnabled);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [crewLoaded, setCrewLoaded] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setBooted(true); });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") { setCrew(null); setCrewLoaded(false); setMembers([]); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id ?? null;
  const loadCrew = useCallback(async () => {
    const sb = supabase();
    if (!sb || !uid) return;
    const { data, error } = await sb.rpc("my_crew");
    if (error) { // offline: fall back to the last crew this phone saw
      try { const c = JSON.parse(localStorage.getItem(`${CREW_CACHE}:${uid}`) ?? "null"); if (c) setCrew(c); } catch { /* ignore */ }
      setCrewLoaded(true);
      return;
    }
    const c = (data as Crew | null) ?? null;
    setCrew(c);
    try { if (c) localStorage.setItem(`${CREW_CACHE}:${uid}`, JSON.stringify(c)); else localStorage.removeItem(`${CREW_CACHE}:${uid}`); } catch { /* ignore */ }
    setCrewLoaded(true);
    if (c) {
      const { data: ms } = await sb.from("crew_members").select("user_id, display_name").eq("crew_id", c.id).order("joined_at");
      if (ms) setMembers(ms as Member[]);
    }
  }, [uid]);

  useEffect(() => { if (uid) { setCrewLoaded(false); loadCrew(); } }, [uid, loadCrew]);

  const status: AuthStatus = !cloudEnabled ? "local" : !booted ? "loading" : !session ? "anon" : !crewLoaded ? "loading" : crew ? "ready" : "nocrew";
  const displayName = (session?.user.user_metadata?.name as string | undefined) ?? session?.user.email?.split("@")[0] ?? "";

  const value = useMemo<Auth>(() => ({
    status, user: session?.user ?? null, crew, members, recovery, displayName,
    signIn: async (email, password) => {
      const { error } = await supabase()!.auth.signInWithPassword({ email: email.trim(), password });
      return error ? nice(error.message) : null;
    },
    signUp: async (email, password, name) => {
      const { data, error } = await supabase()!.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: typeof location !== "undefined" ? location.origin : undefined } });
      if (error) return { error: nice(error.message), needsConfirm: false };
      // Supabase hides "already registered" behind a user with no identities
      if (data.user && data.user.identities?.length === 0) return { error: "That email already has an account. Try signing in.", needsConfirm: false };
      return { error: null, needsConfirm: !data.session };
    },
    signOut: async () => { await supabase()?.auth.signOut(); },
    resetPassword: async (email) => {
      const { error } = await supabase()!.auth.resetPasswordForEmail(email.trim(), { redirectTo: typeof location !== "undefined" ? `${location.origin}/login` : undefined });
      return error ? nice(error.message) : null;
    },
    setNewPassword: async (password) => {
      const { error } = await supabase()!.auth.updateUser({ password });
      if (!error) setRecovery(false);
      return error ? nice(error.message) : null;
    },
    createCrew: async (name, display) => {
      const { error } = await supabase()!.rpc("create_crew", { p_name: name, p_display: display });
      if (error) return error.message;
      await loadCrew();
      return null;
    },
    joinCrew: async (code, display) => {
      const { error } = await supabase()!.rpc("join_crew", { p_code: code, p_display: display });
      if (error) return error.message;
      await loadCrew();
      return null;
    },
  }), [status, session, crew, members, recovery, displayName, loadCrew]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
