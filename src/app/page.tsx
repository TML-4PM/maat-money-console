"use client";
import { useState, useEffect, useCallback } from "react";

// ── Bridge helper ──
async function sql(query: string) {
  const r = await fetch("/api/bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d?.rows || [];
}

// ── Formatting ──
const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDec = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── Status badge ──
function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  return <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider whitespace-nowrap ${colors[color] || colors.slate}`}>{label}</span>;
}

// ── Stat card ──
function Stat({ label, value, sub, badge }: { label: string; value: string | number; sub?: string; badge?: { label: string; color: string } }) {
  return (
    <div className="bg-maat-card border border-maat-border rounded-lg p-4">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      {badge && <div className="mt-2"><Badge {...badge} /></div>}
    </div>
  );
}

// ── Tab definitions ──
const TABS = ["Overview", "Transactions", "Invoices", "R&D / RDTI", "Tax", "Documents", "IP Assets", "Rules"] as const;

export default function Dashboard() {
  const [tab, setTab] = useState<string>("Overview");
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, rdSummary, rdRows, txRecent, txFY26, rules, ipSummary, ipTypes, invoices, invoiceSummary, fySplit, vendorSplit] = await Promise.allSettled([
        sql(`SELECT
          (SELECT COUNT(*) FROM maat_transactions) as tx_count,
          (SELECT COUNT(*) FROM maat_classification_rules) as rule_count,
          (SELECT COUNT(*) FROM ip_assets) as ip_count,
          (SELECT ROUND(SUM(amount)::numeric,2) FROM maat_transactions) as total_spend,
          (SELECT COUNT(*) FROM maat_transactions WHERE is_rd = true) as rd_tx_count,
          (SELECT ROUND(SUM(amount)::numeric,2) FROM maat_transactions WHERE is_rd = true) as rd_spend,
          (SELECT COUNT(*) FROM rd_evidence_matrix) as rd_matrix_rows,
          (SELECT COUNT(*) FROM maat_invoices) as invoice_count,
          (SELECT ROUND(SUM(total)::numeric,2) FROM maat_invoices) as invoice_total,
          (SELECT COUNT(*) FROM maat_transactions WHERE posted_at >= '2025-07-01') as fy26_tx_count,
          (SELECT ROUND(SUM(amount)::numeric,2) FROM maat_transactions WHERE posted_at >= '2025-07-01') as fy26_spend,
          (SELECT COUNT(*) FROM maat_transactions WHERE rd_evidence_id IS NOT NULL) as evidence_linked`),
        sql(`SELECT COUNT(*) as rows, ROUND(SUM(maat_spend)::numeric,2) as spend, ROUND(SUM(rdti_rebate)::numeric,2) as rebate FROM rd_evidence_matrix`),
        sql(`SELECT id, activity_id, activity_title, maat_spend, rdti_rebate, evidence_status, ausind_section FROM rd_evidence_matrix ORDER BY id`),
        sql(`SELECT id, posted_at, description, amount, vendor, category, is_rd, source_file, rd_evidence_id FROM maat_transactions ORDER BY posted_at DESC LIMIT 100`),
        sql(`SELECT id, posted_at, description, amount, vendor, category, is_rd, source_file FROM maat_transactions WHERE posted_at >= '2025-07-01' ORDER BY posted_at DESC`),
        sql(`SELECT id, rule_name, category, gst_treatment, is_rd, rd_project, match_count FROM maat_classification_rules ORDER BY match_count DESC NULLS LAST LIMIT 30`),
        sql(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active, COUNT(CASE WHEN ip_type = 'PATENT' THEN 1 END) as patents, COUNT(CASE WHEN ip_type = 'TRADEMARK' THEN 1 END) as trademarks, COUNT(CASE WHEN ip_type = 'COPYRIGHT' THEN 1 END) as copyrights, COUNT(CASE WHEN ip_type = 'TRADE_SECRET' THEN 1 END) as secrets, COUNT(CASE WHEN ip_type = 'DOMAIN' THEN 1 END) as domains FROM ip_assets`),
        sql(`SELECT ip_type, COUNT(*) as count FROM ip_assets GROUP BY ip_type ORDER BY count DESC`),
        sql(`SELECT id, invoice_number, invoice_date, description, total, status, entity_id FROM maat_invoices ORDER BY invoice_date DESC`),
        sql(`SELECT
          COUNT(*) as total_invoices,
          ROUND(SUM(total)::numeric,2) as total_amount,
          COUNT(CASE WHEN entity_id = '28b43c1b-fc56-4200-b95b-9f3894254dc6' THEN 1 END) as t4h_count,
          ROUND(SUM(CASE WHEN entity_id = '28b43c1b-fc56-4200-b95b-9f3894254dc6' THEN total ELSE 0 END)::numeric,2) as t4h_amount,
          COUNT(CASE WHEN entity_id = '958df194-fa87-44f0-9c9b-98f4b4f9bf23' THEN 1 END) as personal_count,
          ROUND(SUM(CASE WHEN entity_id = '958df194-fa87-44f0-9c9b-98f4b4f9bf23' THEN total ELSE 0 END)::numeric,2) as personal_amount,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
          FROM maat_invoices`),
        sql(`SELECT
          CASE WHEN posted_at >= '2025-07-01' THEN 'FY25-26' ELSE 'FY24-25' END as fy,
          COUNT(*) as cnt,
          ROUND(SUM(amount)::numeric,2) as total,
          COUNT(CASE WHEN is_rd = true THEN 1 END) as rd_count,
          COUNT(CASE WHEN rd_evidence_id IS NOT NULL THEN 1 END) as with_evidence
          FROM maat_transactions GROUP BY fy ORDER BY fy`),
        sql(`SELECT vendor, category, COUNT(*) as cnt, ROUND(SUM(amount)::numeric,2) as total, bool_and(is_rd) as all_rd
          FROM maat_transactions WHERE posted_at >= '2025-07-01'
          GROUP BY vendor, category ORDER BY total DESC`),
      ]);

      setData({
        overview: overview.status === "fulfilled" ? overview.value : null,
        rdSummary: rdSummary.status === "fulfilled" ? rdSummary.value : null,
        rdRows: rdRows.status === "fulfilled" ? rdRows.value : [],
        txRecent: txRecent.status === "fulfilled" ? txRecent.value : [],
        txFY26: txFY26.status === "fulfilled" ? txFY26.value : [],
        rules: rules.status === "fulfilled" ? rules.value : [],
        ipSummary: ipSummary.status === "fulfilled" ? ipSummary.value : null,
        ipTypes: ipTypes.status === "fulfilled" ? ipTypes.value : [],
        invoices: invoices.status === "fulfilled" ? invoices.value : [],
        invoiceSummary: invoiceSummary.status === "fulfilled" ? invoiceSummary.value : null,
        fySplit: fySplit.status === "fulfilled" ? fySplit.value : [],
        vendorSplit: vendorSplit.status === "fulfilled" ? vendorSplit.value : [],
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ov = Array.isArray(data.overview) ? data.overview[0] : data.overview;
  const rds = Array.isArray(data.rdSummary) ? data.rdSummary[0] : data.rdSummary;
  const ips = Array.isArray(data.ipSummary) ? data.ipSummary[0] : data.ipSummary;
  const invs = Array.isArray(data.invoiceSummary) ? data.invoiceSummary[0] : data.invoiceSummary;

  const txList = txFilter === "fy26" ? (data.txFY26 || []) : (data.txRecent || []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-maat-border bg-[#0a1122] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
          <span className="font-mono font-bold text-[15px] tracking-[2px]">MAAT MONEY CONSOLE</span>
          <Badge label="FY2024–26" color="blue" />
          <Badge label="v2.0" color="slate" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={load} className="text-[10px] font-mono text-slate-500 hover:text-maat-accent transition px-2 py-1 border border-maat-border rounded hover:border-maat-accent">↻ REFRESH</button>
          <span className="text-[10px] font-mono text-slate-600">{new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-maat-border bg-[#0a1122] overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-xs font-mono font-semibold tracking-wide transition border-b-2 whitespace-nowrap ${tab === t ? "text-maat-accent border-maat-accent bg-maat-bg" : "text-slate-500 border-transparent hover:text-slate-300"}`}>{t}</button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-5 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm font-mono">
            Bridge error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-500 font-mono text-sm animate-pulse">Connecting to bridge...</div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === "Overview" && ov && (
              <div className="space-y-6">
                {/* Top stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Transactions" value={ov.tx_count || 0} sub={`${ov.evidence_linked || 0} with invoice evidence`} badge={{ label: "LIVE", color: "green" }} />
                  <Stat label="Invoices" value={ov.invoice_count || 0} sub={fmtDec(Number(ov.invoice_total) || 0)} badge={{ label: "SOURCE DOCS", color: "blue" }} />
                  <Stat label="IP Assets" value={ov.ip_count || 0} sub="Registered" />
                  <Stat label="R&D Evidence" value={ov.rd_matrix_rows || 0} sub="AusIndustry rows" badge={{ label: "AUDITABLE", color: "blue" }} />
                </div>

                {/* Financial summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Total Spend" value={fmtDec(Number(ov.total_spend) || 0)} sub="All transactions" />
                  <Stat label="FY25-26 New" value={fmtDec(Number(ov.fy26_spend) || 0)} sub={`${ov.fy26_tx_count || 0} transactions`} badge={{ label: "EMAIL SOURCED", color: "purple" }} />
                  <Stat label="R&D Spend" value={fmtDec(Number(rds?.spend) || 0)} sub={`${ov.rd_tx_count || 0} R&D transactions`} badge={{ label: "VERIFIED", color: "green" }} />
                  <Stat label="RDTI Rebate (43.5%)" value={fmtDec(Number(rds?.rebate) || 0)} sub="Refundable offset" badge={{ label: "76 DAYS TO LODGE", color: "amber" }} />
                </div>

                {/* FY Split */}
                {(data.fySplit || []).length > 0 && (
                  <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                    <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Fiscal Year Breakdown</h3>
                    <div className="space-y-2">
                      {(data.fySplit || []).map((fy: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                          <div className="flex items-center gap-3">
                            <Badge label={fy.fy} color={fy.fy === "FY25-26" ? "purple" : "blue"} />
                            <span className="text-sm text-slate-300">{fy.cnt} transactions</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-white">{fmtDec(Number(fy.total) || 0)}</span>
                            <span className="text-xs text-slate-500">{fy.rd_count} R&D</span>
                            <span className="text-xs text-slate-500">{fy.with_evidence} evidenced</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deadlines */}
                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Critical Deadlines</h3>
                  <div className="space-y-2">
                    {[
                      { item: "AusIndustry Registration", deadline: "30 Apr 2026", status: "NOT STARTED", color: "red" },
                      { item: "T4H Company Tax Return + R&D Schedule", deadline: "30 Apr 2026", status: "NOT LODGED", color: "red" },
                      { item: "3 RDTI Files → Tax Agent", deadline: "Mar 2026", status: "IN GDRIVE", color: "amber" },
                      { item: "BAS Q1-Q4 FY25 (overdue)", deadline: "OVERDUE", status: "CALCULATED", color: "amber" },
                      { item: "4pm.net.au email scan", deadline: "BLOCKED", status: "NO LAMBDA", color: "red" },
                      { item: "Bank statement parsing (next batch)", deadline: "PENDING", status: "USER INPUT", color: "amber" },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <span className="text-sm text-slate-300">{d.item}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500">{d.deadline}</span>
                          <Badge label={d.status} color={d.color} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RDTI Files */}
                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">AusIndustry Submission Pack</h3>
                  <div className="space-y-2">
                    {[
                      { name: "T4H_RD_Activity_Statements_FY2425.docx", desc: "8 R&D activities", status: "COMPLETE", color: "green" },
                      { name: "T4H_RD_Contemporaneous_Records_Pack_FY2425.docx", desc: "11 sections, 29 dated entries", status: "COMPLETE", color: "green" },
                      { name: "T4H_RD_Evidence_Matrix_FY2425.xlsx", desc: "15 rows, verified figures", status: "COMPLETE", color: "green" },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <div>
                          <div className="text-sm font-mono text-white">{f.name}</div>
                          <div className="text-xs text-slate-500">{f.desc}</div>
                        </div>
                        <Badge label={f.status} color={f.color} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-slate-500 font-mono">Location: Google Drive → My Drive → 000A</div>
                </div>
              </div>
            )}

            {/* ── TRANSACTIONS ── */}
            {tab === "Transactions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-sm text-slate-400">
                    {txFilter === "fy26" ? `FY25-26 Transactions (${(data.txFY26 || []).length})` : `Recent Transactions (${(data.txRecent || []).length})`}
                  </h2>
                  <div className="flex gap-2">
                    {(["all", "fy26"] as const).map(f => (
                      <button key={f} onClick={() => setTxFilter(f)} className={`text-[10px] font-mono px-3 py-1 border rounded transition ${txFilter === f ? "text-maat-accent border-maat-accent" : "text-slate-500 border-maat-border hover:text-slate-300"}`}>
                        {f === "all" ? "ALL (100)" : "FY25-26 ONLY"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-maat-border bg-[#0a1122]">
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Vendor</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="text-center p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">R&D</th>
                        <th className="text-center p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Evidence</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txList.map((tx: any, i: number) => (
                        <tr key={i} className={`border-b border-maat-border/50 hover:bg-maat-border/20 transition ${tx.source_file === "gmail-email-scan" ? "bg-purple-500/5" : ""}`}>
                          <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{(tx.posted_at || tx.date)?.slice(0, 10)}</td>
                          <td className="p-3 text-slate-300 max-w-[200px] truncate">{tx.description}</td>
                          <td className="p-3 text-slate-400">{tx.vendor || "—"}</td>
                          <td className="p-3 text-right font-mono text-white whitespace-nowrap">{fmtDec(Number(tx.amount) || 0)}</td>
                          <td className="p-3"><Badge label={tx.category || "UNCAT"} color={tx.category ? "blue" : "slate"} /></td>
                          <td className="p-3 text-center">{tx.is_rd ? <Badge label="R&D" color="green" /> : <span className="text-slate-600">—</span>}</td>
                          <td className="p-3 text-center">{tx.rd_evidence_id ? <Badge label="✓" color="green" /> : <span className="text-slate-600">—</span>}</td>
                          <td className="p-3">{tx.source_file === "gmail-email-scan" ? <Badge label="EMAIL" color="purple" /> : <Badge label="BANK" color="slate" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* FY25-26 Vendor Breakdown */}
                {(data.vendorSplit || []).length > 0 && (
                  <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                    <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">FY25-26 Vendor Breakdown (Email Sourced)</h3>
                    <div className="space-y-2">
                      {(data.vendorSplit || []).map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-300">{v.vendor}</span>
                            <Badge label={v.category || "UNCAT"} color="blue" />
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-500">{v.cnt} txns</span>
                            <span className="text-sm font-mono text-white">{fmtDec(Number(v.total) || 0)}</span>
                            {v.all_rd && <Badge label="R&D" color="green" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── INVOICES ── */}
            {tab === "Invoices" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Total Invoices" value={invs?.total_invoices || 0} sub={fmtDec(Number(invs?.total_amount) || 0)} />
                  <Stat label="T4H Invoices" value={invs?.t4h_count || 0} sub={fmtDec(Number(invs?.t4h_amount) || 0)} badge={{ label: "BUSINESS", color: "blue" }} />
                  <Stat label="Personal Invoices" value={invs?.personal_count || 0} sub={fmtDec(Number(invs?.personal_amount) || 0)} badge={{ label: "RECLASSIFY?", color: "amber" }} />
                  <Stat label="Overdue" value={invs?.overdue_count || 0} badge={Number(invs?.overdue_count) > 0 ? { label: "ACTION", color: "red" } : { label: "CLEAR", color: "green" }} />
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-maat-border bg-[#0a1122]">
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Invoice #</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Total</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Entity</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.invoices || []).map((inv: any, i: number) => {
                        const isT4H = inv.entity_id === "28b43c1b-fc56-4200-b95b-9f3894254dc6";
                        const isOverdue = inv.status === "overdue";
                        return (
                          <tr key={i} className={`border-b border-maat-border/50 hover:bg-maat-border/20 transition ${isOverdue ? "bg-red-500/5" : ""}`}>
                            <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{inv.invoice_date?.slice(0, 10)}</td>
                            <td className="p-3 font-mono text-slate-500 max-w-[150px] truncate">{inv.invoice_number}</td>
                            <td className="p-3 text-slate-300 max-w-[250px] truncate">{inv.description}</td>
                            <td className="p-3 text-right font-mono text-white whitespace-nowrap">{fmtDec(Number(inv.total) || 0)}</td>
                            <td className="p-3"><Badge label={isT4H ? "T4H" : "PERSONAL"} color={isT4H ? "blue" : "amber"} /></td>
                            <td className="p-3"><Badge label={inv.status?.toUpperCase() || "UNKNOWN"} color={isOverdue ? "red" : inv.status === "paid" ? "green" : "slate"} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Data Gaps */}
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-3">Known Invoice Gaps</h3>
                  <div className="space-y-2 text-sm text-slate-300">
                    {[
                      { gap: "4pm.net.au email inaccessible — OpenAI ($21.6K/yr), Supabase ($6.25K/yr), DCC ($46.5K), Vercel, GoDaddy", status: "BLOCKED", color: "red" },
                      { gap: "FY25-26 Jul–Oct 2025 T4H costs — zero email invoices for this period", status: "GAP", color: "amber" },
                      { gap: "FY24-25 invoice evidence — 194 transactions with zero linked source docs", status: "BACKFILL", color: "amber" },
                      { gap: "PDF attachment amounts — estimated from MAAT averages, not verified", status: "ESTIMATED", color: "amber" },
                      { gap: "Personal costs (SG Fleet, Amber Electric) — potential work reclassification pending", status: "REVIEW", color: "blue" },
                    ].map((g, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border/30 last:border-0">
                        <span>{g.gap}</span>
                        <Badge label={g.status} color={g.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── R&D / RDTI ── */}
            {tab === "R&D / RDTI" && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="R&D Spend" value={fmtDec(Number(rds?.spend) || 0)} badge={{ label: "VERIFIED", color: "green" }} />
                  <Stat label="RDTI Rebate" value={fmtDec(Number(rds?.rebate) || 0)} sub="43.5% refundable" />
                  <Stat label="Evidence Rows" value={rds?.rows || 0} sub="AusIndustry format" badge={{ label: "AUDITABLE", color: "blue" }} />
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-maat-border bg-[#0a1122]">
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">ID</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Activity</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Spend</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Rebate</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Section</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.rdRows || []).map((r: any, i: number) => (
                        <tr key={i} className="border-b border-maat-border/50 hover:bg-maat-border/20 transition">
                          <td className="p-3 font-mono text-slate-500">{r.activity_id || r.id}</td>
                          <td className="p-3 text-slate-300 max-w-[250px] truncate">{r.activity_title || "—"}</td>
                          <td className="p-3 text-right font-mono text-white">{fmtDec(Number(r.maat_spend) || 0)}</td>
                          <td className="p-3 text-right font-mono text-emerald-400">{fmtDec(Number(r.rdti_rebate) || 0)}</td>
                          <td className="p-3 font-mono text-slate-400">{r.ausind_section || "—"}</td>
                          <td className="p-3"><Badge label={r.evidence_status || "PARTIAL"} color={r.evidence_status === "COMPLETE" ? "green" : "amber"} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#0a1122] font-bold">
                        <td className="p-3" colSpan={2}><span className="font-mono text-[10px] text-slate-400 uppercase">Totals</span></td>
                        <td className="p-3 text-right font-mono text-white">{fmtDec(Number(rds?.spend) || 0)}</td>
                        <td className="p-3 text-right font-mono text-emerald-400">{fmtDec(Number(rds?.rebate) || 0)}</td>
                        <td className="p-3" colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAX ── */}
            {tab === "Tax" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Entity" value="T4H Pty Ltd" sub="ABN 70 666 271 272" />
                  <Stat label="Tax Agent" value="Gordon McKirdy" sub="Assigned" />
                  <Stat label="Company Tax" value="NOT LODGED" badge={{ label: "BLOCKER", color: "red" }} />
                  <Stat label="BAS Status" value="4 Overdue" badge={{ label: "OVERDUE", color: "red" }} />
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Obligations Pipeline</h3>
                  <div className="space-y-2">
                    {[
                      { item: "BAS Q1 FY25 (Jul-Sep 2024)", amount: "$5,699", status: "CALCULATED", color: "amber" },
                      { item: "BAS Q2 FY25 (Oct-Dec 2024)", amount: "$5,699", status: "CALCULATED", color: "amber" },
                      { item: "BAS Q3 FY25 (Jan-Mar 2025)", amount: "$5,699", status: "CALCULATED", color: "amber" },
                      { item: "BAS Q4 FY25 (Apr-Jun 2025)", amount: "$5,699", status: "CALCULATED", color: "amber" },
                      { item: "R&D Tax Incentive FY25", amount: fmtDec(Number(rds?.rebate) || 0), status: "NOT REGISTERED", color: "red" },
                      { item: "Company Income Tax FY25", amount: "TBD", status: "NOT LODGED", color: "red" },
                    ].map((o, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <span className="text-sm text-slate-300">{o.item}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-mono text-white">{o.amount}</span>
                          <Badge label={o.status} color={o.color} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {tab === "Documents" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Stat label="Document Store" value="PLANNED" sub="Needs maat_documents table" badge={{ label: "NOT BUILT", color: "amber" }} />
                  <Stat label="PDF Invoices" value="20" sub="Attachments not extractable" badge={{ label: "GMAIL LIMIT", color: "red" }} />
                  <Stat label="Bank Statements" value="PENDING" sub="Next batch from user" badge={{ label: "AWAITING", color: "amber" }} />
                </div>

                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Document Store Roadmap</h3>
                  <div className="space-y-2 text-sm">
                    {[
                      { item: "maat_documents table", desc: "Store document metadata: type, entity, date, file_ref, source", status: "SCHEMA NEEDED", color: "amber" },
                      { item: "Invoice PDF storage", desc: "Link PDF files from email to invoice records via S3 or GDrive", status: "ARCHITECTURE", color: "amber" },
                      { item: "Bank statement parser", desc: "Ingest CSV/PDF bank statements, auto-classify transactions", status: "NEXT BATCH", color: "blue" },
                      { item: "Receipt OCR pipeline", desc: "Extract amounts from PDF receipts (Textract or similar)", status: "FUTURE", color: "slate" },
                      { item: "4pm.net.au email connector", desc: "Lambda for Microsoft Graph API to read GoDaddy/M365 mailbox", status: "BLOCKED", color: "red" },
                      { item: "Evidence chain", desc: "Link: bank_txn → invoice → email → PDF for audit trail", status: "DESIGN", color: "blue" },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <div>
                          <div className="text-slate-300">{d.item}</div>
                          <div className="text-xs text-slate-500">{d.desc}</div>
                        </div>
                        <Badge label={d.status} color={d.color} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Email Sources</h3>
                  <div className="space-y-2 text-sm">
                    {[
                      { source: "troy.latter@gmail.com", labels: "Label_10 (T4H finance), Label_14 (mixed), Label_16 (personal)", status: "SCANNED", color: "green" },
                      { source: "troy.latter@4pm.net.au", labels: "GoDaddy/M365 — finance folder", status: "INACCESSIBLE", color: "red" },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <div>
                          <div className="font-mono text-slate-300">{s.source}</div>
                          <div className="text-xs text-slate-500">{s.labels}</div>
                        </div>
                        <Badge label={s.status} color={s.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── IP ASSETS ── */}
            {tab === "IP Assets" && ips && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Stat label="Total IP" value={ips.total || 0} />
                  <Stat label="Patents" value={ips.patents || 0} />
                  <Stat label="Trademarks" value={ips.trademarks || 0} />
                  <Stat label="Copyrights" value={ips.copyrights || 0} />
                  <Stat label="Domains" value={ips.domains || 0} />
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">IP by Type</h3>
                  <div className="space-y-2">
                    {(data.ipTypes || []).map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <span className="text-sm font-mono">{t.ip_type || "UNKNOWN"}</span>
                        <span className="text-sm font-mono text-white font-bold">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── RULES ── */}
            {tab === "Rules" && (
              <div className="space-y-4">
                <h2 className="font-mono text-sm text-slate-400">Classification Rules (by match count)</h2>
                <div className="bg-maat-card border border-maat-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-maat-border bg-[#0a1122]">
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Rule</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">GST</th>
                        <th className="text-center p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">R&D</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">R&D Project</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.rules || []).map((r: any, i: number) => (
                        <tr key={i} className="border-b border-maat-border/50 hover:bg-maat-border/20 transition">
                          <td className="p-3 text-slate-300 max-w-[200px] truncate">{r.rule_name}</td>
                          <td className="p-3"><Badge label={r.category || "—"} color="blue" /></td>
                          <td className="p-3 font-mono text-slate-400">{r.gst_treatment || "—"}</td>
                          <td className="p-3 text-center">{r.is_rd ? <Badge label="YES" color="green" /> : <span className="text-slate-600">—</span>}</td>
                          <td className="p-3 font-mono text-slate-400 max-w-[150px] truncate">{r.rd_project || "—"}</td>
                          <td className="p-3 text-right font-mono text-white">{r.match_count ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-maat-border px-5 py-3 text-center">
        <span className="text-[10px] font-mono text-slate-600">Tech 4 Humanity Pty Ltd · ABN 70 666 271 272 · MAAT Money Console v2.0 · Bridge: m5oqj21chd</span>
      </footer>
    </div>
  );
}
