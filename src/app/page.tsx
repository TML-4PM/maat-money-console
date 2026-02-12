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
  // Bridge returns { body: string } with JSON-encoded result
  const body = typeof d.body === "string" ? JSON.parse(d.body) : d.body;
  return body?.result || body?.rows || body || [];
}

// ── Formatting ──
const fmt = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDec = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── Status badge ──
function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = { green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", amber: "bg-amber-500/15 text-amber-400 border-amber-500/30", red: "bg-red-500/15 text-red-400 border-red-500/30", blue: "bg-blue-500/15 text-blue-400 border-blue-500/30", slate: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  return <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${colors[color] || colors.slate}`}>{label}</span>;
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
const TABS = ["Overview", "Transactions", "R&D / RDTI", "Tax", "IP Assets", "Rules"] as const;

export default function Dashboard() {
  const [tab, setTab] = useState<string>("Overview");
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, rdSummary, rdRows, txSample, rules, ipSummary, ipTypes, basSummary, txCount] = await Promise.allSettled([
        sql(`SELECT
          (SELECT COUNT(*) FROM maat_transactions) as tx_count,
          (SELECT COUNT(*) FROM maat_classification_rules) as rule_count,
          (SELECT COUNT(*) FROM ip_assets) as ip_count,
          (SELECT ROUND(SUM(amount)::numeric,2) FROM maat_transactions) as total_spend,
          (SELECT COUNT(*) FROM maat_transactions WHERE is_rd = true) as rd_tx_count,
          (SELECT ROUND(SUM(amount)::numeric,2) FROM maat_transactions WHERE is_rd = true) as rd_spend,
          (SELECT COUNT(*) FROM rd_evidence_matrix) as rd_matrix_rows`),
        sql(`SELECT COUNT(*) as rows, ROUND(SUM(maat_spend)::numeric,2) as spend, ROUND(SUM(rdti_rebate)::numeric,2) as rebate FROM rd_evidence_matrix`),
        sql(`SELECT id, activity_id, activity_title, maat_spend, rdti_rebate, evidence_status, ausind_section FROM rd_evidence_matrix ORDER BY id`),
        sql(`SELECT id, date, description, amount, vendor, category, is_rd, rd_project FROM maat_transactions ORDER BY date DESC LIMIT 50`),
        sql(`SELECT id, rule_name, category, gst_treatment, is_rd, rd_project, match_count FROM maat_classification_rules ORDER BY match_count DESC NULLS LAST LIMIT 30`),
        sql(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active, COUNT(CASE WHEN ip_type = 'PATENT' THEN 1 END) as patents, COUNT(CASE WHEN ip_type = 'TRADEMARK' THEN 1 END) as trademarks, COUNT(CASE WHEN ip_type = 'COPYRIGHT' THEN 1 END) as copyrights, COUNT(CASE WHEN ip_type = 'TRADE_SECRET' THEN 1 END) as secrets, COUNT(CASE WHEN ip_type = 'DOMAIN' THEN 1 END) as domains FROM ip_assets`),
        sql(`SELECT ip_type, COUNT(*) as count FROM ip_assets GROUP BY ip_type ORDER BY count DESC`),
        sql(`SELECT 
          ROUND(SUM(CASE WHEN category = 'GST_COLLECTED' THEN amount ELSE 0 END)::numeric,2) as gst_collected,
          ROUND(SUM(CASE WHEN category = 'GST_PAID' THEN amount ELSE 0 END)::numeric,2) as gst_paid
          FROM maat_transactions`),
        sql(`SELECT COUNT(*) as total FROM maat_transactions`),
      ]);

      setData({
        overview: overview.status === "fulfilled" ? overview.value : null,
        rdSummary: rdSummary.status === "fulfilled" ? rdSummary.value : null,
        rdRows: rdRows.status === "fulfilled" ? rdRows.value : [],
        txSample: txSample.status === "fulfilled" ? txSample.value : [],
        rules: rules.status === "fulfilled" ? rules.value : [],
        ipSummary: ipSummary.status === "fulfilled" ? ipSummary.value : null,
        ipTypes: ipTypes.status === "fulfilled" ? ipTypes.value : [],
        basSummary: basSummary.status === "fulfilled" ? basSummary.value : null,
        txCount: txCount.status === "fulfilled" ? txCount.value : null,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Extract first row from array results
  const ov = Array.isArray(data.overview) ? data.overview[0] : data.overview;
  const rds = Array.isArray(data.rdSummary) ? data.rdSummary[0] : data.rdSummary;
  const ips = Array.isArray(data.ipSummary) ? data.ipSummary[0] : data.ipSummary;
  const bas = Array.isArray(data.basSummary) ? data.basSummary[0] : data.basSummary;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-maat-border bg-[#0a1122] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
          <span className="font-mono font-bold text-[15px] tracking-[2px]">MAAT MONEY CONSOLE</span>
          <Badge label="T4H FY2024-25" color="blue" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={load} className="text-[10px] font-mono text-slate-500 hover:text-maat-accent transition px-2 py-1 border border-maat-border rounded hover:border-maat-accent">↻ REFRESH</button>
          <span className="text-[10px] font-mono text-slate-600">{new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-maat-border bg-[#0a1122]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 text-xs font-mono font-semibold tracking-wide transition border-b-2 ${tab === t ? "text-maat-accent border-maat-accent bg-maat-bg" : "text-slate-500 border-transparent hover:text-slate-300"}`}>{t}</button>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Transactions" value={ov.tx_count || 0} sub="Classified in MAAT" badge={{ label: "LIVE", color: "green" }} />
                  <Stat label="Classification Rules" value={ov.rule_count || 0} sub="Active matching" />
                  <Stat label="IP Assets" value={ov.ip_count || 0} sub="Registered" />
                  <Stat label="R&D Evidence Rows" value={ov.rd_matrix_rows || 0} sub="AusIndustry ready" badge={{ label: "AUDITABLE", color: "blue" }} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Stat label="Total Spend" value={fmtDec(Number(ov.total_spend) || 0)} sub="All transactions" />
                  <Stat label="R&D Spend" value={fmtDec(Number(rds?.spend) || 0)} sub={`${ov.rd_tx_count || 0} R&D transactions`} badge={{ label: "VERIFIED", color: "green" }} />
                  <Stat label="RDTI Rebate (43.5%)" value={fmtDec(Number(rds?.rebate) || 0)} sub="Refundable offset" badge={{ label: "76 DAYS TO LODGE", color: "amber" }} />
                </div>

                {/* Deadlines */}
                <div className="bg-maat-card border border-maat-border rounded-lg p-5">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Critical Deadlines</h3>
                  <div className="space-y-2">
                    {[
                      { item: "AusIndustry Registration", deadline: "30 Apr 2026", days: 76, status: "NOT STARTED", color: "red" },
                      { item: "T4H Company Tax Return + R&D Schedule", deadline: "30 Apr 2026", days: 76, status: "NOT LODGED", color: "red" },
                      { item: "3 RDTI Files → Tax Agent", deadline: "Mar 2026", days: 45, status: "IN GDRIVE", color: "amber" },
                      { item: "BAS Q1-Q4 FY25 (overdue)", deadline: "OVERDUE", days: 0, status: "CALCULATED", color: "amber" },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <span className="text-sm">{d.item}</span>
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
                      { name: "T4H_RD_Activity_Statements_FY2425.docx", desc: "8 R&D activities", status: "COMPLETE" },
                      { name: "T4H_RD_Contemporaneous_Records_Pack_FY2425.docx", desc: "11 sections, 29 dated entries", status: "COMPLETE" },
                      { name: "T4H_RD_Evidence_Matrix_FY2425.xlsx", desc: "15 rows, verified figures", status: "COMPLETE" },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-maat-border last:border-0">
                        <div>
                          <div className="text-sm font-mono text-white">{f.name}</div>
                          <div className="text-xs text-slate-500">{f.desc}</div>
                        </div>
                        <Badge label={f.status} color="green" />
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
                  <h2 className="font-mono text-sm text-slate-400">Recent Transactions (50 shown)</h2>
                </div>
                <div className="bg-maat-card border border-maat-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-maat-border bg-[#0a1122]">
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Vendor</th>
                        <th className="text-right p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="text-left p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="text-center p-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">R&D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.txSample || []).map((tx: any, i: number) => (
                        <tr key={i} className="border-b border-maat-border/50 hover:bg-maat-border/20 transition">
                          <td className="p-3 font-mono text-slate-400">{tx.date?.slice(0, 10)}</td>
                          <td className="p-3 text-slate-300 max-w-[200px] truncate">{tx.description}</td>
                          <td className="p-3 text-slate-400">{tx.vendor || "—"}</td>
                          <td className="p-3 text-right font-mono text-white">{fmtDec(Number(tx.amount) || 0)}</td>
                          <td className="p-3"><Badge label={tx.category || "UNCAT"} color={tx.category ? "blue" : "slate"} /></td>
                          <td className="p-3 text-center">{tx.is_rd ? <Badge label="R&D" color="green" /> : <span className="text-slate-600">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        <span className="text-[10px] font-mono text-slate-600">Tech 4 Humanity Pty Ltd · ABN 70 666 271 272 · MAAT Money Console v1.0 · Bridge: m5oqj21chd</span>
      </footer>
    </div>
  );
}
