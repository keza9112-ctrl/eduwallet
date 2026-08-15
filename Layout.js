import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { Bell, LogOut, Wallet, Menu, X, CheckCheck } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

const roleLabel = { parent: "Parent", student: "Student", patron: "Patron / Matron", admin: "Administrator" };

export default function Layout({ nav = [], children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);

  const loadNotes = () => api.get("/notifications").then((r) => setNotes(r.data)).catch(() => {});
  useEffect(() => { loadNotes(); const t = setInterval(loadNotes, 15000); return () => clearInterval(t); }, []);

  const unread = notes.filter((n) => !n.read).length;
  const markAll = async () => { await api.post("/notifications/read-all"); loadNotes(); };

  return (
    <div className="min-h-screen flex bg-[#F9F9F8]">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 h-full w-64 bg-[#1A4331] text-white flex-col transition-transform ${open ? "flex" : "hidden lg:flex"}`}>
        <div className="p-6 flex items-center gap-2 border-b border-white/10">
          <div className="w-9 h-9 rounded-md bg-[#E25A3C] flex items-center justify-center"><Wallet size={20} strokeWidth={1.5} /></div>
          <span className="font-head font-extrabold text-lg tracking-tight">EduWallet</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <button key={item.to} data-testid={`nav-${item.key}`} onClick={() => { navigate(item.to); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors ${active ? "bg-white text-[#1A4331] font-semibold" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={18} strokeWidth={1.5} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/60 mb-1">{roleLabel[user?.role]}</div>
          <div className="text-sm font-medium truncate mb-3">{user?.name}</div>
          <Button data-testid="logout-btn" onClick={() => { logout(); navigate("/"); }} variant="ghost"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white px-2 h-9">
            <LogOut size={16} strokeWidth={1.5} className="mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-black/5 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="menu-toggle">{open ? <X size={22} /> : <Menu size={22} />}</button>
            <h1 className="font-head font-bold text-xl text-[#171717]">{title}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="notifications-bell" className="relative p-2 rounded-full hover:bg-black/5 transition-colors">
                <Bell size={20} strokeWidth={1.5} />
                {unread > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 text-[10px] font-bold flex items-center justify-center rounded-full bg-[#E25A3C] text-white">{unread}</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-head font-bold text-sm">Notifications</span>
                {unread > 0 && <button data-testid="mark-all-read" onClick={markAll} className="text-xs text-[#1A4331] flex items-center gap-1 hover:underline"><CheckCheck size={13} /> Mark all read</button>}
              </div>
              <div className="max-h-80 overflow-auto scrollbar-thin">
                {notes.length === 0 && <div className="px-4 py-8 text-center text-sm text-neutral-400">No notifications yet</div>}
                {notes.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${!n.read ? "bg-[#F9F9F8]" : ""}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.kind === "success" ? "bg-[#10B981]" : n.kind === "error" ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`} />
                      <div>
                        <div className="text-sm font-medium text-[#171717]">{n.title}</div>
                        <div className="text-xs text-neutral-500">{n.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
