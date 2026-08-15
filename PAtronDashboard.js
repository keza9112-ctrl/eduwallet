import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError, fmt } from "../lib/api";
import Layout from "../components/Layout";
import { Card, Stat, Money, StatusBadge, TxTable } from "../components/Bits";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { LayoutDashboard, ScanLine, Banknote, ShieldCheck, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const nav = [{ key: "dash", to: "/patron", label: "Verify & Cash-out", icon: LayoutDashboard }];

export default function PatronDashboard() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/withdrawals").then((r) => setPending(r.data)).catch(() => {});
    api.get("/transactions").then((r) => setHistory(r.data)).catch(() => {});
  };
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const verify = async (c, p) => {
    setBusy(true); setVerified(null);
    try {
      const { data } = await api.post("/withdrawals/verify", { code: c ?? code, pin: p ?? pin });
      setVerified(data.request); setOpen(true);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await api.post(`/withdrawals/${verified.id}/complete`);
      toast.success(`Cash issued: RWF ${fmt(verified.amount)}`);
      setOpen(false); setVerified(null); setCode(""); setPin(""); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const todayIssued = history.reduce((a, b) => a + b.amount, 0);

  return (
    <Layout nav={nav} title="Patron / Matron Desk">
      <div className="grid sm:grid-cols-3 gap-4 md:gap-6 mb-6">
        <Stat testid="stat-pending" label="Pending Requests" value={pending.length} icon={Clock} accent="#F59E0B" />
        <Stat testid="stat-issued" label="Cash Issued" value={<Money amount={todayIssued} />} icon={Banknote} accent="#10B981" />
        <Stat testid="stat-processed" label="Processed" value={history.length} icon={ShieldCheck} />
      </div>

      <Card className="p-6 mb-6">
        <h2 className="font-head font-bold text-lg mb-1 flex items-center gap-2"><ScanLine size={18} /> Verify a cash-out</h2>
        <p className="text-sm text-neutral-500 mb-4">Enter the request code and secure PIN the student shows you (or read them off the QR code).</p>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div><Label>Request code</Label><Input data-testid="verify-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WD-XXXXXXXX" className="mt-1.5 font-mono" /></div>
          <div><Label>Secure PIN</Label><Input data-testid="verify-pin-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="000000" maxLength={6} className="mt-1.5 font-mono tracking-widest" /></div>
          <Button data-testid="verify-btn" onClick={() => verify()} disabled={busy || !code || !pin} className="bg-[#1A4331] hover:bg-[#123022] text-white h-11 rounded-md">{busy ? <Loader2 className="animate-spin" size={16} /> : "Verify"}</Button>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-head font-bold text-lg mb-4">Pending Requests</h2>
        {pending.length === 0 ? <div className="py-10 text-center text-sm text-neutral-400">No pending requests right now.</div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((r) => (
              <div key={r.id} className="border rounded-md p-4" data-testid={`pending-card-${r.id}`}>
                <div className="font-semibold">{r.student_name}</div>
                <div className="text-xs text-neutral-400 font-mono">{r.code}</div>
                <div className="my-2"><Money amount={r.amount} className="text-lg font-semibold text-[#1A4331]" /></div>
                <Button data-testid={`process-btn-${r.id}`} onClick={() => { setCode(r.code); setPin(""); toast.info("Enter the PIN the student shows you"); }} variant="outline" className="w-full rounded-full border-[#E25A3C] text-[#E25A3C] hover:bg-[#E25A3C] hover:text-white">Process</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-head font-bold text-lg mb-4">Cash-out History</h2>
        <TxTable items={history} cols={[
          { key: "created_at", label: "Date", render: (t) => <span className="text-neutral-500">{new Date(t.created_at).toLocaleString()}</span> },
          { key: "student_name", label: "Student" },
          { key: "amount", label: "Amount", render: (t) => <Money amount={t.amount} /> },
          { key: "reference", label: "Code", render: (t) => <span className="font-mono text-xs text-neutral-500">{t.reference}</span> },
          { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
        ]} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-head">Confirm cash issue</DialogTitle></DialogHeader>
          {verified && (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={44} className="mx-auto text-[#10B981]" strokeWidth={1.5} />
              <div>
                <div className="text-sm text-neutral-500">Verified request for</div>
                <div className="font-head font-bold text-xl">{verified.student_name}</div>
              </div>
              <div className="text-4xl font-mono font-semibold text-[#1A4331]">RWF {fmt(verified.amount)}</div>
              <p className="text-sm text-neutral-500">Hand over the cash, then confirm to debit the wallet.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1"><XCircle size={16} className="mr-1.5" /> Cancel</Button>
                <Button data-testid="confirm-cashout-btn" onClick={complete} disabled={busy} className="flex-1 bg-[#1A4331] hover:bg-[#123022] text-white">{busy ? <Loader2 className="animate-spin" size={16} /> : "Confirm & issue cash"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
