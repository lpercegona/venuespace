import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    // Revalidate session against Auth server; if the stored token is stale
    // (legacy signing key after rotation, revoked, expired), sign out locally
    // so the app returns to /auth instead of looping with 401s.
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data?.user) {
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session);
      setUser(s.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
