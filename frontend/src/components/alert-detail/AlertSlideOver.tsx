"use client";

import React, { useEffect, useState } from "react";
import { X, ShieldAlert, ArrowRightLeft, FileCode, CheckCircle2, Download, AlertOctagon } from "lucide-react";
import { ClassifiedAlert, Transaction } from "@/lib/types";
import { RiskBadge } from "@/components/common/RiskBadge";
import { fetchTransactions } from "@/lib/api";

interface AlertSlideOverProps {
  alert: ClassifiedAlert | null;
  onClose: () => void;
}

export const AlertSlideOver: React.FC<AlertSlideOverProps> = ({ alert, onClose }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!alert || !alert.transaction_ids || alert.transaction_ids.length === 0) {
      setTransactions([]);
      return;
    }

    setLoadingTx(true);
    fetchTransactions(alert.transaction_ids.slice(0, 100))
      .then((res) => setTransactions(res.items))
      .catch((err) => console.error("Error loading transactions:", err))
      .finally(() => setLoadingTx(false));
  }, [alert]);

  if (!alert) return null;

  const formattedId = alert.classified_alert_id.startsWith("#")
    ? alert.classified_alert_id
    : `#${alert.classified_alert_id.replace("CALERT-", "ALT-")}`;

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alert, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `alert_${alert.classified_alert_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(alert.classified_alert_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity duration-300">
      <div
        className="w-full max-w-2xl bg-[#090D16] border-l border-cyan-500/20 h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slide-over Header */}
        <div className="p-5 border-b border-white/5 bg-[#0C121E] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-base font-black text-cyan-400">
                  {formattedId}
                </span>
                <RiskBadge level={alert.risk_level} />
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Score: {alert.risk_score}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                <span>Account: <strong className="text-slate-200 font-mono">{alert.account_id}</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-teal-400">{alert.status}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Summary Details */}
          <div className="glass-card rounded-xl p-4 border border-cyan-500/15 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center justify-between">
              <span>Alert Classification Summary</span>
              <span className="font-mono text-[10px] text-slate-500 font-normal">
                {alert.timestamp}
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Primary Alert Type</div>
                <div className="font-semibold text-slate-200 mt-0.5">{alert.alert_type}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Traced Transactions</div>
                <div className="font-semibold text-cyan-400 font-mono mt-0.5">
                  {alert.transaction_ids?.length || 0} source records
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Detected Reason</div>
              <div className="text-xs text-slate-200 leading-relaxed font-medium">
                {alert.detected_reason}
              </div>
            </div>
          </div>

          {/* Triggered Rules & Forensic Evidence */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
              <span>Evidence by Triggered Rule ({alert.triggered_rules?.length || 0})</span>
            </h3>

            <div className="space-y-2.5">
              {Object.entries(alert.evidence || {}).map(([ruleName, ruleEvidence]) => (
                <div
                  key={ruleName}
                  className="rounded-xl p-3.5 bg-[#0C121E] border border-slate-800 hover:border-cyan-500/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                      {ruleName}
                    </span>
                    <span className="text-[10px] text-slate-500">Forensic Trace Ready</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 font-mono text-xs">
                    {typeof ruleEvidence === "object" && ruleEvidence !== null ? (
                      Object.entries(ruleEvidence).map(([key, val]) => (
                        <div key={key} className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                          <div className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
                            {key.replace(/_/g, " ")}
                          </div>
                          <div className="font-bold text-slate-200 mt-0.5 truncate">
                            {typeof val === "number" && val % 1 !== 0
                              ? val.toFixed(2)
                              : String(val)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 text-slate-300">{String(ruleEvidence)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Traced Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span>Traced Source Transactions ({transactions.length})</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Showing up to 100
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0C121E] overflow-hidden">
              {loadingTx ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-cyan-500 border-t-transparent mb-1.5" />
                  <div>Loading source transactions...</div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No source transaction records available.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-2">TX ID</th>
                        <th className="p-2">STEP</th>
                        <th className="p-2">SOURCE</th>
                        <th className="p-2">DEST</th>
                        <th className="p-2 text-right">AMOUNT (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {transactions.map((tx) => (
                        <tr key={tx.transaction_id} className="hover:bg-slate-800/40">
                          <td className="p-2 text-cyan-400 font-semibold">{tx.transaction_id}</td>
                          <td className="p-2 text-slate-400">{tx.step}</td>
                          <td className="p-2">{tx.source_account_id}</td>
                          <td className="p-2">{tx.dest_account_id}</td>
                          <td className="p-2 text-right font-bold text-slate-100">
                            ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Slide-over Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-[#0C121E] flex items-center justify-between gap-3">
          <button
            onClick={handleCopyId}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> : <FileCode className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied ID" : "Copy ID"}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportJson}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <a
              href={`/investigations/${alert.classified_alert_id}`}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-glow-cyan"
            >
              <span>Investigate Alert</span>
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
