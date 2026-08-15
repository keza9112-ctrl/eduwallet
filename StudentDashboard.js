import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import api, { apiError, fmt } from "../lib/api";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Card, Money, StatusBadge, TxTable } from "../components/Bits";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { LayoutDashboard, ArrowDownToLine, Copy, Wallet, QrCode, Loader2, Clock } from "lucide-react";

const nav = [{ key: "dash", to: "/student", label: "Dashboard", icon: LayoutDashboard }];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, student_code: "" });
  const [txs, setTxs] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(null);

  const load = () => {
    api.get("/wallet/me").then((r) => setWallet(r.data)).catch(() => {});
    api.get("/transactions").then((r) => setTxs(r.data)).catch(() => {});
    api.get("/withdrawals").then((r) => setReqs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const request = async () => {
    if (!amount) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const { data } = await api.post("/withdrawals", { amount: parseFloat(amount), reason });
      setTicket(data); setOpen(true); setAmount(""); setReason(""); load();
      toast.success("Cash-out request created");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <Layout nav={nav} title="My Wallet">
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        {/* Balance hero */}
        <Card className="lg:col-span-2 relative overflow-hidden p-8 bg-[#1A4331] text-white border-0">
          <div className="absolute inset-0 noise-overlay opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/70 text-sm"><Wallet size={18} strokeWidth={1.5} /> Available Balance</div>
            <div className="font-mono font-semibold text-5xl mt-3 tracking-tight" data-testid="wallet-balance">RWF {fmt(wallet.balance)}</div>
            <div className="mt-6 flex items-center gap-3">
              <div className="text-xs text-white/60">Your student code</div>
              <button onClick={() => copy(wallet.student_code)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 text-sm font-mono transition-colors" data-testid="copy-student-code">
                {wallet.student_code} <Copy size={13} />
              </button>
            </div>
          </div>
        </Card>
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-head font-bold text-lg">Need cash?</h3>
            <p className="text-sm text-neutral-500 mt-1">Request a cash-out, then show the code & PIN to your school patron.</p>
          </div>
          <div className="space-y-3 mt-4">
            <Input data-testid="withdraw-amount-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (RWF)" className="font-mono" />
            <Input data-testid="withdraw-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
            <Button data-testid="request-withdraw-btn" onClick={request} disabled={busy} className="w-full bg-[#E25A3C] hover:bg-[#c94a2f] text-white rounded-md h-11">
              {busy ? <Loader2 className="animate-spin" size={16} /> : <><ArrowDownToLine size={16} className="mr-1.5" /> Request cash-out</>}
            </Button>
          </div>
        </Card>
      </div>

      {reqs.filter((r) => r.status === "PENDING").length > 0 && (
        <Card className="p-6 mb-6 border-[#F59E0B]/30 bg-[#F59E0B]/5">
          <h2 className="font-head font-bold text-lg mb-3 flex items-center gap-2"><Clock size={18} className="text-[#B45309]" /> Pending cash-out requests</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {reqs.filter((r) => r.status === "PENDING").map((r) => (
              <button key={r.id} onClick={() => { setTicket({ ...r, qr_payload: `${r.code}:${r.pin}` }); setOpen(true); }} data-testid={`pending-req-${r.id}`}
                className="text-left border rounded-md p-4 bg-white hover:-translate-y-[1px] transition-transform">
                <Money amount={r.amount} className="font-semibold text-[#1A4331]" />
                <div className="text-xs text-neutral-400 font-mono mt-1">{r.code} · tap to show QR</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-head font-bold text-lg mb-4">Transaction History</h2>
        <TxTable items={txs} cols={[
          { key: "created_at", label: "Date", render: (t) => <span className="text-neutral-500">{new Date(t.created_at).toLocaleDateString()}</span> },
          { key: "type", label: "Type", render: (t) => <span className="capitalize">{t.type}</span> },
          { key: "amount", label: "Amount", render: (t) => <span className={t.type === "deposit" ? "text-[#059669]" : "text-[#DC2626]"}><Money amount={t.amount} /></span> },
          { key: "method", label: "Via", render: (t) => <span className="text-neutral-500">{t.method}</span> },
          { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
        ]} />
      </Card>

      {/* Ticket dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-head flex items-center gap-2"><QrCode size={18} /> Show this to the Patron</DialogTitle></DialogHeader>
          {ticket && (
            <div className="space-y-4 text-center">
              <div className="text-3xl font-mono font-semibold text-[#1A4331]">RWF {fmt(ticket.amount)}</div>
              <div className="flex justify-center p-4 bg-white border rounded-md">
                <QRCodeCanvas value={ticket.qr_payload || `${ticket.code}:${ticket.pin}`} size={180} fgColor="#1A4331" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md p-3">
                  <div className="text-xs text-neutral-400">Request code</div>
                  <button onClick={() => copy(ticket.code)} className="font-mono font-semibold flex items-center gap-1 mx-auto mt-1" data-testid="ticket-code">{ticket.code} <Copy size={12} /></button>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs text-neutral-400">Secure PIN</div>
                  <div className="font-mono font-semibold text-lg tracking-widest mt-1" data-testid="ticket-pin">{ticket.pin}</div>
                </div>
              </div>
              <p className="text-xs text-neutral-400">The patron scans the QR or enters the code + PIN to issue your cash.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
