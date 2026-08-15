import React from "react";
import { fmt } from "../lib/api";

export function Card({ className = "", children, ...p }) {
  return <div className={`bg-white border border-black/5 rounded-md ${className}`} {...p}>{children}</div>;
}

export function Stat({ label, value, icon: Icon, accent = "#1A4331", sub, testid }) {
  return (
    <Card className="p-6 hover:-translate-y-[1px] transition-transform" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 font-medium">{label}</div>
          <div className="font-head font-extrabold text-2xl mt-2 text-[#171717]">{value}</div>
          {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
        </div>
        {Icon && <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}><Icon size={20} strokeWidth={1.5} /></div>}
      </div>
    </Card>
  );
}

export function Money({ amount, className = "" }) {
  return <span className={`font-mono ${className}`}>RWF {fmt(amount)}</span>;
}

const badge = {
  SUCCESSFUL: "bg-[#10B981]/10 text-[#059669]",
  COMPLETED: "bg-[#10B981]/10 text-[#059669]",
  PENDING: "bg-[#F59E0B]/10 text-[#B45309]",
  FAILED: "bg-[#EF4444]/10 text-[#DC2626]",
};

export function StatusBadge({ status }) {
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge[status] || "bg-neutral-100 text-neutral-600"}`}>{status}</span>;
}

export function TxTable({ items, cols }) {
  if (!items || items.length === 0)
    return <div className="py-12 text-center text-sm text-neutral-400">No transactions yet.</div>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-neutral-400 border-b">
            {cols.map((c) => <th key={c.key} className="py-3 px-3 font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id || i} className="border-b last:border-0 hover:bg-[#F9F9F8] transition-colors" data-testid={`tx-row-${i}`}>
              {cols.map((c) => <td key={c.key} className="py-3 px-3">{c.render ? c.render(it) : it[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
