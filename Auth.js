import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Wallet, ShieldCheck, Loader2, ArrowRight } from "lucide-react";

const CAMPUS = "https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b";
const home = { parent: "/parent", student: "/student", patron: "/patron", admin: "/admin" };

export default function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | register | otp
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "parent" });
  const [otp, setOtp] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target?.value ?? e });

  const doLogin = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
      if (data.needs_verification) { setMode("otp"); toast.info("Verify your email — code sent."); return; }
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      navigate(home[data.user.role]);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const doRegister = async () => {
    setBusy(true);
    try {
      await api.post("/auth/register", form);
      setMode("otp");
      toast.success("Account created! Enter the code sent to your email.");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const doVerify = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email: form.email, code: otp });
      login(data.token, data.user);
      toast.success("Email verified!");
      navigate(home[data.user.role]);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    try { await api.post("/auth/resend-otp", { email: form.email }); toast.success("New code sent."); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F9F9F8]">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[#1A4331] text-white overflow-hidden">
        <div className="absolute inset-0 noise-overlay opacity-40" />
        <img src={CAMPUS} alt="campus" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        <div className="relative flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-[#E25A3C] flex items-center justify-center"><Wallet size={22} strokeWidth={1.5} /></div>
          <span className="font-head font-extrabold text-2xl tracking-tight">EduWallet</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="font-head font-extrabold text-4xl xl:text-5xl leading-tight tracking-tight">Pocket money,<br />reimagined for<br />boarding schools.</h1>
          <p className="text-white/70 text-base max-w-md">Parents deposit via mobile money. Students spend safely. Patrons issue cash with a secure PIN. All in one trusted wallet built for Rwandan schools.</p>
          <div className="flex items-center gap-3 text-sm text-white/80"><ShieldCheck size={18} strokeWidth={1.5} /> Bank-grade security · OTP verified · Full audit trail</div>
        </div>
        <div className="relative text-xs text-white/40 font-mono">Made for Rwanda · RWF</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-md bg-[#1A4331] flex items-center justify-center"><Wallet size={20} strokeWidth={1.5} className="text-white" /></div>
            <span className="font-head font-extrabold text-xl">EduWallet</span>
          </div>

          {mode === "otp" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-head font-bold text-2xl">Verify your email</h2>
                <p className="text-sm text-neutral-500 mt-1">We sent a 6-digit code to <span className="font-medium text-[#171717]">{form.email}</span></p>
              </div>
              <div>
                <Label>Verification code</Label>
                <Input data-testid="otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6}
                  placeholder="000000" className="mt-2 font-mono text-2xl tracking-[0.5em] text-center h-14" />
              </div>
              <Button data-testid="verify-otp-btn" onClick={doVerify} disabled={busy || otp.length < 6}
                className="w-full h-11 rounded-md bg-[#1A4331] hover:bg-[#123022] text-white">
                {busy ? <Loader2 className="animate-spin" size={18} /> : "Verify & continue"}
              </Button>
              <div className="text-center text-sm text-neutral-500">
                Didn't get it? <button data-testid="resend-otp-btn" onClick={resend} className="text-[#E25A3C] font-medium hover:underline">Resend code</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-head font-bold text-2xl">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
                <p className="text-sm text-neutral-500 mt-1">{mode === "login" ? "Sign in to your EduWallet." : "Join as a parent or student."}</p>
              </div>

              {mode === "register" && (
                <>
                  <div>
                    <Label>Full name</Label>
                    <Input data-testid="name-input" value={form.name} onChange={set("name")} placeholder="e.g. Jean Bosco" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>I am a…</Label>
                    <Select value={form.role} onValueChange={set("role")}>
                      <SelectTrigger data-testid="role-select" className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent / Guardian</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label>Email</Label>
                <Input data-testid="email-input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" className="mt-1.5" />
              </div>
              <div>
                <Label>Password</Label>
                <Input data-testid="password-input" type="password" value={form.password} onChange={set("password")} placeholder="••••••••"
                  className="mt-1.5" onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? doLogin() : doRegister())} />
              </div>

              <Button data-testid="submit-auth-btn" onClick={mode === "login" ? doLogin : doRegister} disabled={busy}
                className="w-full h-11 rounded-md bg-[#1A4331] hover:bg-[#123022] text-white group">
                {busy ? <Loader2 className="animate-spin" size={18} /> : <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} className="ml-1 group-hover:translate-x-0.5 transition-transform" /></>}
              </Button>

              <div className="text-center text-sm text-neutral-500">
                {mode === "login" ? (
                  <>New to EduWallet? <button data-testid="switch-register" onClick={() => setMode("register")} className="text-[#E25A3C] font-medium hover:underline">Create an account</button></>
                ) : (
                  <>Already have an account? <button data-testid="switch-login" onClick={() => setMode("login")} className="text-[#E25A3C] font-medium hover:underline">Sign in</button></>
                )}
              </div>

              {mode === "login" && (
                <div className="text-xs text-neutral-400 bg-white border rounded-md p-3 font-mono leading-relaxed">
                  Demo: parent@demo.rw · student@demo.rw · patron@demo.rw — password <b>Demo@2026</b>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
