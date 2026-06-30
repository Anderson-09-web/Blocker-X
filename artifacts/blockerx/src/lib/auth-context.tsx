import React, { createContext, useContext, useEffect, useRef } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  const [location, setLocation] = useLocation();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      if (
        !redirectedRef.current &&
        location !== "/" &&
        !location.startsWith("/api/auth")
      ) {
        redirectedRef.current = true;
        setLocation("/");
      }
    } else {
      redirectedRef.current = false;
      if (user.isBanned) {
        return;
      }
      if (!user.hasInvite && !user.isAdmin && location !== "/invite") {
        setLocation("/invite");
      } else if ((user.hasInvite || user.isAdmin) && (location === "/" || location === "/invite")) {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
