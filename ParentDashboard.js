import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError, fmt } from "../lib/api";
import Layout from "../components/Layout";
import { Card, Stat, Money, StatusBadge, TxTable } from "../components/Bits";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { LayoutDashboard, Receipt, Users, Plus, UserPlus, Loader2, Wallet, Smartphone, CheckCircle2 } from "lucide-react";

const nav = [
  { key: "dash", to: "/parent", label: "Dashboard", icon: LayoutDashboard },
];

export default function ParentDashboard() {
  const [students, setStudents] = useState([]);
  const [txs, setTxs] = useState([]);
  const [linkCode, setLinkCode] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [dep, setDep] = useState({ student_id: "", amount: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [depState, setDepState] = useState(null); // null|pending|SUCCESSFUL|FAILED

  const load = () => {
    api.get("/parent/students").then((r) => setStudents(r.data)).catch(() => {});
    api.get("/transactions").then((r) => setTxs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const totalDeposited = txs.filter((t) => t.status === "SUCCESSFUL").reduce((a, b) => a + b.amount, 0);

  const linkStudent = async () => {
    setBusy(true);
    try { const r = await api.post("/parent/link-student", { student_code: linkCode }); toast.success(r.data.message); setLinkOpen(false); setLinkCode(""); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const deposit = async () => {
    if (!dep.student_id || !dep.amount || !dep.phone) return toast.error("Fill all fields");
    setBusy(true); setDepState("pending");
    try {
      const { data } = await api.post("/deposits", { student_id: dep.student_id, amount: parseFloat(dep.amount), phone: dep.phone });
      const ref = data.reference;
      const poll = setInterval(async () => {
        const s = await api.get(`/deposits/${ref}`);
        if (s.data.status !== "PENDING") {
          clearInterval(poll);
          setDepState(s.data.status);
          if (s.data.status === "SUCCESSFUL") toast.success("Deposit successful!");
          else toast.error("Deposit failed");
          load();
        }
      }, 2500);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); setDepState(null); }
    finally { setBusy(false); }
  };

  const openDeposit = (sid) => { setDep({ student_id: sid || "", amount: "", phone: "" }); setDepState(null); setDepOpen(true); };

  return (
    <Layout nav={nav} title="Parent Dashboard">
      <div className="grid sm:grid-cols-3 gap-4 md:gap-6 mb-6">
        <Stat testid="stat-students" label="Linked Students" value={students.length} icon={Users} />
        <Stat testid="stat-deposited" label="Total Deposited" value={<Money amount={totalDeposited} />} icon={Wallet} accent="#10B981" />
        <Stat testid="stat-transactions" label="Transactions" value={txs.length} icon={Receipt} accent="#E25A3C" />
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head font-bold text-lg">My Students</h2>
          <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
            <DialogTrigger asChild>
              <Button data-testid="link-student-btn" variant="outline" className="rounded-full border-[#1A4331] text-[#1A4331] hover:bg-[#1A4331] hover:text-white"><UserPlus size={16} className="mr-1.5" /> Link student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-head">Link a student</DialogTitle></DialogHeader>
              <p className="text-sm text-neutral-500">Enter the student's unique code (e.g. STU-XXXXXXXX). Ask your child or the school administrator.</p>
              <Label>Student code</Label>
              <Input data-testid="link-code-input" value={linkCode} onChange={(e) => setLinkCode(e.target.value)} placeholder="STU-XXXXXXXX" className="font-mono" />
              <DialogFooter><Button data-testid="link-submit-btn" onClick={linkStudent} disabled={busy} className="bg-[#1A4331] hover:bg-[#123022] text-white">{busy ? <Loader2 className="animate-spin" size={16} /> : "Link"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {students.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-400">No students linked yet. Link one to start depositing.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {students.map((s) => (
              <div key={s.id} data-testid={`student-card-${s.id}`} className="border border-black/5 rounded-md p-5 flex items-center justify-between hover:-translate-y-[1px] transition-transform">
                <div>
                  <div className="font-semibold text-[#171717]">{s.name}</div>
                  <div className="text-xs text-neutral-400 font-mono">{s.student_code}</div>
                  <div className="mt-2"><Money amount={s.balance} className="text-lg font-semibold text-[#1A4331]" /></div>
                </div>
                <Button data-testid={`deposit-btn-${s.id}`} onClick={() => openDeposit(s.id)} className="rounded-full bg-[#E25A3C] hover:bg-[#c94a2f] text-white"><Plus size={16} className="mr-1" /> Deposit</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-head font-bold text-lg mb-4">Recent Deposits</h2>
        <TxTable items={txs} cols={[
          { key: "created_at", label: "Date", render: (t) => <span className="text-neutral-500">{new Date(t.created_at).toLocaleDateString()}</span> },
          { key: "student_name", label: "Student" },
          { key: "amount", label: "Amount", render: (t) => <Money amount={t.amount} /> },
          { key: "method", label: "Method", render: (t) => <span className="text-neutral-500">{t.method}</span> },
          { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
        ]} />
      </Card>

      {/* Deposit dialog */}
      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-head flex items-center gap-2"><Smartphone size={18} /> Mobile Money Deposit</DialogTitle></DialogHeader>
          {depState === "SUCCESSFUL" ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 size={48} className="mx-auto text-[#10B981]" strokeWidth={1.5} />
              <div className="font-head font-bold text-lg">Deposit successful</div>
              <p className="text-sm text-neutral-500">The money is now in the student's wallet.</p>
              <Button data-testid="deposit-done-btn" onClick={() => setDepOpen(false)} className="bg-[#1A4331] text-white">Done</Button>
            </div>
          ) : depState === "pending" ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 size={40} className="mx-auto animate-spin text-[#1A4331]" />
              <div className="font-medium">Waiting for confirmation…</div>
              <p className="text-sm text-neutral-500">Approve the MTN MoMo prompt on the phone.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Student</Label>
                <Select value={dep.student_id} onValueChange={(v) => setDep({ ...dep, student_id: v })}>
                  <SelectTrigger data-testid="deposit-student-select" className="mt-1.5"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (RWF)</Label>
                <Input data-testid="deposit-amount-input" type="number" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} placeholder="10000" className="mt-1.5 font-mono" />
                <div className="flex gap-2 mt-2">{[5000, 10000, 20000].map((a) => <button key={a} onClick={() => setDep({ ...dep, amount: String(a) })} className="text-xs px-3 py-1 rounded-full border hover:border-[#1A4331] font-mono">{fmt(a)}</button>)}</div>
              </div>
              <div>
                <Label>MoMo phone number</Label>
                <Input data-testid="deposit-phone-input" value={dep.phone} onChange={(e) => setDep({ ...dep, phone: e.target.value })} placeholder="2507XXXXXXXX" className="mt-1.5 font-mono" />
              </div>
              <Button data-testid="deposit-submit-btn" onClick={deposit} disabled={busy} className="w-full h-11 bg-[#E25A3C] hover:bg-[#c94a2f] text-white rounded-md">Request payment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
