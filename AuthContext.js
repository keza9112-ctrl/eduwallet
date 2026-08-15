import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=guest, obj=user
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ew_token");
    if (!token) { setUser(false); setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("ew_token"); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, u) => {
    localStorage.setItem("ew_token", token);
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("ew_token");
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, setUser, login, logout, loading }}>{children}</AuthCtx.Provider>;
}
