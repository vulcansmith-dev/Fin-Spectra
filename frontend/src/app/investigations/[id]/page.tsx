"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ShieldAlert, 
  Cpu, 
  GitFork, 
  Activity, 
  Network, 
  UserCheck, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowLeft, 
  Play,
  RotateCw,
  Download
} from "lucide-react";
import { fetchAlertById, startInvestigation, getAuditReportUrl } from "@/lib/api";
import { ClassifiedAlert, InvestigationResult } from "@/lib/types";
import { RiskBadge } from "@/components/common/RiskBadge";

interface Props {
  params: { id: string };
}

export default function InvestigationDetailPage({ params }: Props) {
  const alertId = params.id;
  const cleanId = alertId.replace(/^#/, "");

  const [alert, setAlert] = useState<ClassifiedAlert | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [loadingAlert, setLoadingAlert] = useState<boolean>(true);
  const [runningInvestigation, setRunningInvestigation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "plan" | "dossier">("overview");

  useEffect(() => {
    async function loadInitialData() {
      setLoadingAlert(true);
      try {
        const alertData = await fetchAlertById(cleanId);
        setAlert(alertData);
        // If alert was already investigated, trigger or check result automatically
        if (alertData.status === "RESOLVED" || alertData.status === "ESCALATED" || alertData.status === "CLOSED" || alertData.status === "UNDER_INVESTIGATION") {
          runPipelineSilently(cleanId);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load alert details");
      } finally {
        setLoadingAlert(false);
      }
    }
    loadInitialData();
  }, [cleanId]);

  const runPipelineSilently = async (id: string) => {
    try {
      const res = await startInvestigation(id);
      setInvestigation(res);
    } catch (e) {
      // Non-blocking silent load
    }
  };

  const handleStartInvestigation = async () => {
    setRunningInvestigation(true);
    setError(null);
    try {
      const result = await startInvestigation(cleanId);
      setInvestigation(result);
      // Refresh alert status
      const updatedAlert = await fetchAlertById(cleanId);
      setAlert(updatedAlert);
    } catch (err: any) {
      setError(err.message || "Investigation execution failed");
    } finally {
      setRunningInvestigation(false);
    }
  };

  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);

  const handleDownloadAuditReport = async () => {
    setDownloadingReport(true);
    try {
      const url = getAuditReportUrl(cleanId);
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Audit report not found. Please run the investigation pipeline first.");
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `CASE_${cleanId}_final_audit.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      if (typeof window !== "undefined") {
        window.alert(err.message || "Failed to download audit report.");
      }
    } finally {
      setDownloadingReport(false);
    }
  };

  const state = investigation?.state;
  const behavioral = state?.behavioral_metrics || {};
  const graph = state?.graph_metrics || {};
  const decision = investigation?.decision || state?.decision || "PENDING";
  const finalScore = investigation?.final_risk_score ?? state?.final_risk_score ?? alert?.risk_score ?? 0;
  const isInvestigated = Boolean(state || (alert && alert.status !== "OPEN"));

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <Link href="/alert-queue" className="hover:text-cyan-400 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Alert Queue
          </Link>
          <span>/</span>
          <span className="text-cyan-400 font-mono font-semibold">#{cleanId}</span>
        </div>

        <div className="flex items-center space-x-3">
          {isInvestigated ? (
            <button
              onClick={handleDownloadAuditReport}
              disabled={downloadingReport}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingReport ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Downloading Report...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>📄 Download Final Audit Report (.docx)</span>
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              title="Run the Phase-2 investigation pipeline first to generate the audit report"
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed opacity-60"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>📄 Audit Report Not Available</span>
            </button>
          )}

          <button
            onClick={handleStartInvestigation}
            disabled={runningInvestigation}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {runningInvestigation ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Executing LangGraph Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Phase-2 Multi-Agent Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Alert Header Banner */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold rounded-md">
                #{cleanId}
              </span>
              {alert && <RiskBadge level={alert.risk_level} />}
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-md uppercase tracking-wider">
                Status: {alert?.status || "OPEN"}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>{alert?.alert_type || "Financial Crime Alert"}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              {alert?.detected_reason || "Phase-1 alert handed off to Phase-2 LangGraph Multi-Agent Engine"}
            </p>
          </div>

          {/* Decision & Score Metrics */}
          <div className="flex items-center space-x-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Risk Score</div>
              <div className="text-2xl font-bold font-mono text-cyan-400">{finalScore.toFixed(1)}</div>
            </div>
            <div className="text-center px-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Pipeline Decision</div>
              <div className="mt-1">
                {decision === "BLOCK" && (
                  <span className="px-3 py-1 bg-red-950/80 border border-red-500/40 text-red-400 font-bold text-xs rounded-full">
                    ⛔ BLOCK
                  </span>
                )}
                {decision === "REVIEW" && (
                  <span className="px-3 py-1 bg-amber-950/80 border border-amber-500/40 text-amber-400 font-bold text-xs rounded-full">
                    ⚠️ REVIEW
                  </span>
                )}
                {decision === "ALLOW" && (
                  <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded-full">
                    ✅ ALLOW
                  </span>
                )}
                {decision === "PENDING" && (
                  <span className="px-3 py-1 bg-slate-800 text-slate-400 font-medium text-xs rounded-full">
                    ⏳ NOT EXECUTED
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 border-b-2 ${
            activeTab === "overview"
              ? "border-cyan-400 text-cyan-400 bg-slate-900/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Forensic Analytics & Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab("plan")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 border-b-2 ${
            activeTab === "plan"
              ? "border-cyan-400 text-cyan-400 bg-slate-900/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Multi-Agent Workflow Execution ({state?.task_list?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("dossier")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 border-b-2 ${
            activeTab === "dossier"
              ? "border-cyan-400 text-cyan-400 bg-slate-900/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Generated SAR Narrative Dossier</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & METRICS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Behavioral Analysis Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center space-x-2.5 text-cyan-400 font-semibold text-sm">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3>Behavioral Z-Score Baseline</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Velocity Z-Score</div>
                <div className="text-lg font-bold font-mono text-cyan-300">
                  {behavioral.velocity_z_score !== undefined ? behavioral.velocity_z_score.toFixed(2) : "0.00"}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Pass-Through Ratio</div>
                <div className="text-lg font-bold font-mono text-cyan-300">
                  {behavioral.pass_through_ratio !== undefined ? `${(behavioral.pass_through_ratio * 100).toFixed(1)}%` : "0.0%"}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Volume Surge Ratio</div>
                <div className="text-lg font-bold font-mono text-cyan-300">
                  {behavioral.volume_surge_ratio !== undefined ? `${behavioral.volume_surge_ratio.toFixed(2)}x` : "1.00x"}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Baseline Samples</div>
                <div className="text-lg font-bold font-mono text-slate-300">
                  {behavioral.historical_samples ?? 0} transactions
                </div>
              </div>
            </div>
          </div>

          {/* Graph Topology Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center space-x-2.5 text-purple-400 font-semibold text-sm">
              <Network className="w-4 h-4 text-purple-400" />
              <h3>Graph Topology & Entity Network</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Connected Accounts</div>
                <div className="text-lg font-bold font-mono text-purple-300">{graph.account_count ?? 1}</div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Beneficiary Dispersion</div>
                <div className="text-lg font-bold font-mono text-purple-300">
                  {graph.beneficiary_dispersion_ratio !== undefined ? graph.beneficiary_dispersion_ratio.toFixed(2) : "0.00"}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Multi-Beneficiary Flag</div>
                <div className="text-sm font-semibold text-slate-300 mt-1">
                  {graph.multi_beneficiary_flag ? "⚠️ DETECTED" : "✅ NORMAL"}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <div className="text-slate-400">Self-Transfer Risk</div>
                <div className="text-sm font-semibold text-slate-300 mt-1">
                  {graph.self_transfer_detected ? "⚠️ SUSPICIOUS" : "NONE"}
                </div>
              </div>
            </div>
          </div>

          {/* KYC Notes & Profile Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold text-sm">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h3>Customer Verification & KYC Audit</h3>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-mono">
              {state?.kyc_notes || "KYC verification pending agent execution."}
            </div>
          </div>

          {/* Typology & Forensics Card */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center space-x-2.5 text-amber-400 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3>Typology Classifier</h3>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Classification:</span>
                <span className="font-bold text-amber-400 font-mono">{state?.typology_classification || "UNCLASSIFIED"}</span>
              </div>
              <p className="text-slate-300 italic text-[11px] leading-snug">
                {state?.typology_rationale || "Typology classification rationale will appear after pipeline execution."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-AGENT EXECUTION PLAN */}
      {activeTab === "plan" && (
        <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>LangGraph Agent Execution Sequence</span>
          </h3>

          {!state?.task_list || state.task_list.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No tasks executed yet. Click "Run Phase-2 Multi-Agent Pipeline" to invoke LangGraph.
            </div>
          ) : (
            <div className="space-y-2">
              {state.task_list.map((task: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-mono text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">{task.name}</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] rounded-full uppercase">
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GENERATED SAR DOSSIER */}
      {activeTab === "dossier" && (
        <div className="p-6 bg-slate-900/70 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Automated Suspicious Activity Report (SAR) Dossier & Audit</span>
            </h3>

            {isInvestigated && (
              <button
                onClick={handleDownloadAuditReport}
                disabled={downloadingReport}
                className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/40 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingReport ? "Downloading..." : "Download Audit Report (.docx)"}</span>
              </button>
            )}
          </div>

          {!state?.dossier ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No dossier generated yet. Run the investigation pipeline to assemble the SAR report.
            </div>
          ) : (
            <pre className="p-5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {state.dossier}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}