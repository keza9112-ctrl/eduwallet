import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api, { apiError, fmt } from "../lib/api";
import Layout from "../components/Layout";
import { Card, Stat, Money, StatusBadge, TxTable } from "../components/Bits";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { LayoutDashboard, Users, School, Wallet, ArrowDownUp, Plus, Trash2, ShieldAlert, Loader2, GraduationCap } from "lucide-react";

const nav = [{ key: "dash", to: "/admin", label: "Overview", icon: LayoutDashboard }];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [logs, setLogs] = useState([]);
  const [userOpen, setUserOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", password: "", role: "patron", phone: "", school_id: "" });
  const [ns, setNs] = useState({ name: "", district: "" });

  const load = () => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
    api.get("/admin/schools").then((r) => setSchools(r.data)).catch(() => {});
    api.get("/admin/audit-logs").then((r) => setLogs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    setBusy(true);
    try { await api.post("/admin/users", nu); toast.success("User created"); setUserOpen(false); setNu({ name: "", email: "", password: "", role: "patron", phone: "", school_id: "" }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const createSchool = async () => {
    setBusy(true);
    try { await api.post("/admin/schools", ns); toast.success("School added"); setSchoolOpen(false); setNs({ name: "", district: "" }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const delUser = async (id) => {
    try { await api.delete(`/admin/users/${id}`); toast.success("User removed"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const roleBadge = (r) => {
    const m = { admin: "bg-[#1A4331]/10 text-[#1A4331]", patron: "bg-[#E25A3C]/10 text-[#c94a2f]", student: "bg-[#10B981]/10 text-[#059669]", parent: "bg-[#F59E0B]/10 text-[#B45309]" };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${m[r]}`}>{r}</span>;
  };

  return (
    <Layout nav={nav} title="Administrator">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <Stat testid="stat-balance" label="Total Wallet Value" value={<Money amount={stats?.total_balance || 0} />} icon={Wallet} accent="#1A4331" />
        <Stat testid="stat-students" label="Students" value={stats?.total_students ?? "—"} icon={GraduationCap} accent="#10B981" />
        <Stat testid="stat-schools" label="Schools" value={stats?.total_schools ?? "—"} icon={School} accent="#E25A3C" />
        <Stat testid="stat-pending-wd" label="Pending Cash-outs" value={stats?.pending_withdrawals ?? "—"} icon={ArrowDownUp} accent="#F59E0B" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="font-head font-bold text-lg mb-4">Money Flow</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats?.chart || []}>
              <defs>
                <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1A4331" stopOpacity={0.3} /><stop offset="100%" stopColor="#1A4331" stopOpacity={0} /></linearGradient>
                <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E25A3C" stopOpacity={0.3} /><stop offset="100%" stopColor="#E25A3C" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a3a3a3" }} tickFormatter={(d) => d?.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#a3a3a3" }} tickFormatter={(v) => `${v / 1000}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => `RWF ${fmt(v)}`} contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 12 }} />
              <Area type="monotone" dataKey="deposits" stroke="#1A4331" strokeWidth={2} fill="url(#gD)" />
              <Area type="monotone" dataKey="withdrawals" stroke="#E25A3C" strokeWidth={2} fill="url(#gW)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6 flex flex-col gap-4">
          <h2 className="font-head font-bold text-lg">Totals</h2>
          <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-neutral-500">Deposited</span><Money amount={stats?.total_deposited || 0} className="font-semibold text-[#059669]" /></div>
          <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-neutral-500">Withdrawn</span><Money amount={stats?.total_withdrawn || 0} className="font-semibold text-[#DC2626]" /></div>
          <div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-neutral-500">Parents</span><span className="font-mono font-semibold">{stats?.total_parents ?? "—"}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-neutral-500">Patrons</span><span className="font-mono font-semibold">{stats?.total_patrons ?? "—"}</span></div>
        </Card>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="schools" data-testid="tab-schools">Schools</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="flex justify-end mb-4">
              <Dialog open={userOpen} onOpenChange={setUserOpen}>
                <DialogTrigger asChild><Button data-testid="add-user-btn" className="rounded-full bg-[#1A4331] hover:bg-[#123022] text-white"><Plus size={16} className="mr-1.5" /> Add user</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-head">Create user</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div><Label>Name</Label><Input data-testid="nu-name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className="mt-1.5" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Email</Label><Input data-testid="nu-email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className="mt-1.5" /></div>
                      <div><Label>Password</Label><Input data-testid="nu-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} className="mt-1.5" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Role</Label>
                        <Select value={nu.role} onValueChange={(v) => setNu({ ...nu, role: v })}>
                          <SelectTrigger data-testid="nu-role" className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="patron">Patron/Matron</SelectItem><SelectItem value="student">Student</SelectItem><SelectItem value="parent">Parent</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label>School</Label>
                        <Select value={nu.school_id} onValueChange={(v) => setNu({ ...nu, school_id: v })}>
                          <SelectTrigger data-testid="nu-school" className="mt-1.5"><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button data-testid="nu-submit" onClick={createUser} disabled={busy} className="bg-[#1A4331] text-white">{busy ? <Loader2 className="animate-spin" size={16} /> : "Create"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <TxTable items={users} cols={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email", render: (u) => <span className="text-neutral-500">{u.email}</span> },
              { key: "role", label: "Role", render: (u) => roleBadge(u.role) },
              { key: "student_code", label: "Code / Balance", render: (u) => u.role === "student" ? <span className="font-mono text-xs">{u.student_code} · {fmt(u.balance)}</span> : "—" },
              { key: "action", label: "", render: (u) => u.role !== "admin" ? <button data-testid={`del-user-${u.id}`} onClick={() => delUser(u.id)} className="text-neutral-400 hover:text-[#EF4444]"><Trash2 size={16} /></button> : null },
            ]} />
          </TabsContent>

          <TabsContent value="schools">
            <div className="flex justify-end mb-4">
              <Dialog open={schoolOpen} onOpenChange={setSchoolOpen}>
                <DialogTrigger asChild><Button data-testid="add-school-btn" className="rounded-full bg-[#1A4331] hover:bg-[#123022] text-white"><Plus size={16} className="mr-1.5" /> Add school</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-head">Add school</DialogTitle></DialogHeader>
                  <div><Label>School name</Label><Input data-testid="ns-name" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>District</Label><Input data-testid="ns-district" value={ns.district} onChange={(e) => setNs({ ...ns, district: e.target.value })} className="mt-1.5" /></div>
                  <DialogFooter><Button data-testid="ns-submit" onClick={createSchool} disabled={busy} className="bg-[#1A4331] text-white">{busy ? <Loader2 className="animate-spin" size={16} /> : "Add"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <TxTable items={schools} cols={[
              { key: "name", label: "School" },
              { key: "district", label: "District", render: (s) => <span className="text-neutral-500">{s.district || "—"}</span> },
              { key: "code", label: "Code", render: (s) => <span className="font-mono text-xs">{s.code}</span> },
              { key: "students", label: "Students", render: (s) => <span className="font-mono">{s.students}</span> },
            ]} />
          </TabsContent>

          <TabsContent value="audit">
            <div className="flex items-center gap-2 mb-4 text-sm text-neutral-500"><ShieldAlert size={16} /> Immutable record of all sensitive actions.</div>
            <TxTable items={logs} cols={[
              { key: "created_at", label: "Time", render: (l) => <span className="text-neutral-500 font-mono text-xs">{new Date(l.created_at).toLocaleString()}</span> },
              { key: "actor_name", label: "Actor", render: (l) => <span>{l.actor_name} <span className="text-xs text-neutral-400">({l.actor_role})</span></span> },
              { key: "action", label: "Action", render: (l) => <span className="font-mono text-xs bg-neutral-100 px-2 py-0.5 rounded">{l.action}</span> },
              { key: "detail", label: "Detail", render: (l) => <span className="text-neutral-500">{l.detail}</span> },
            ]} />
          </TabsContent>
        </Tabs>
      </Card>
    </Layout>
  );
}
