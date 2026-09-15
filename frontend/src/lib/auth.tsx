import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, mutate, setCsrf } from "./api";
import { sessionSchema } from "./contracts";
import type { User } from "./contracts";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (capability: string) => boolean;
};
const Auth = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const client = useQueryClient();
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const session = await api("/auth/me", sessionSchema);
      setCsrf(session.csrf_token);
      setUser(session.user);
    } catch (error) {
      if ((error as { status?: number }).status !== 401)
        setError(error as Error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const expired = () => {
      setCsrf("");
      setUser(null);
      client.clear();
    };
    window.addEventListener("northstar:session-expired", expired);
    return () =>
      window.removeEventListener("northstar:session-expired", expired);
  }, []);
  async function signIn(email: string, password: string) {
    const session = await api("/auth/login", sessionSchema, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    client.clear();
    setCsrf(session.csrf_token);
    setUser(session.user);
    setError(null);
  }
  async function signOut() {
    await mutate("/auth/logout", {});
    setCsrf("");
    setUser(null);
    client.clear();
  }
  return (
    <Auth.Provider
      value={{
        user,
        loading,
        error,
        refresh,
        signIn,
        signOut,
        can: (capability) => !!user?.capabilities.includes(capability),
      }}
    >
      {children}
    </Auth.Provider>
  );
}
export function useAuth() {
  const context = useContext(Auth);
  if (!context) throw new Error("AuthProvider missing");
  return context;
}
