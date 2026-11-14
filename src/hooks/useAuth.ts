"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Email sign-in with a one-time code. No passwords. Once signed in, the
// device stays signed in (the session renews itself) until "Sign out".

export interface AuthUser {
  id: string;
  email: string;
}

export interface UseAuth {
  /** false while we check for a saved sign-in on this device. */
  ready: boolean;
  user: AuthUser | null;
  /** Email a 6-digit code. Resolves to an error message, or null on success. */
  sendCode: (email: string) => Promise<string | null>;
  /** Check the code. Resolves to an error message, or null on success. */
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

function friendly(message: string | undefined, fallback: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("expired") || m.includes("invalid")) return "That code didn't work. Check it, or ask for a new one.";
  if (m.includes("rate") || m.includes("seconds") || m.includes("too many"))
    return "Please wait a minute before asking for another code.";
  if (m.includes("fetch") || m.includes("network")) return "Couldn't connect. Check your internet and try again.";
  if (m.includes("email") && m.includes("valid")) return "That email address doesn't look right.";
  return fallback;
}

export function useAuth(): UseAuth {
  const [ready, setReady] = useState(!supabase);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const apply = (u: { id: string; email?: string } | null | undefined) => {
      if (!active) return;
      // Keep the same object when nothing changed, so the journal isn't reloaded
      // every time the session quietly renews.
      setUser((prev) => {
        if (!u) return null;
        if (prev && prev.id === u.id && prev.email === (u.email ?? "")) return prev;
        return { id: u.id, email: u.email ?? "" };
      });
    };
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session?.user))
      .catch(() => apply(null))
      .finally(() => active && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return "Sign-in isn't set up.";
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          // If someone taps the link in the email instead of typing the code,
          // bring them back to the journal.
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/" : undefined,
        },
      });
      return error ? friendly(error.message, "Couldn't send the code. Please try again.") : null;
    } catch {
      return "Couldn't connect. Check your internet and try again.";
    }
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return "Sign-in isn't set up.";
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "email",
      });
      return error ? friendly(error.message, "That code didn't work. Check it, or ask for a new one.") : null;
    } catch {
      return "Couldn't connect. Check your internet and try again.";
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // "local" signs out this device only, and works even with no connection.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setUser(null);
  }, []);

  return { ready, user, sendCode, verifyCode, signOut };
}
