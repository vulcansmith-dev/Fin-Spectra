import { PipelineSummary, AlertsResponse, ClassifiedAlert, TransactionsResponse, InvestigationResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchSummary(): Promise<PipelineSummary> {
  const res = await fetch(`${API_BASE}/api/summary`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAlerts(params?: {
  risk_level?: string;
  search?: string;
  typology?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<AlertsResponse> {
  const query = new URLSearchParams();
  if (params?.risk_level) query.set("risk_level", params.risk_level);
  if (params?.search) query.set("search", params.search);
  if (params?.typology) query.set("typology", params.typology);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.page_size) query.set("page_size", params.page_size.toString());

  const res = await fetch(`${API_BASE}/api/alerts?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch alerts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAlertById(id: string): Promise<ClassifiedAlert> {
  const cleanId = encodeURIComponent(id.replace(/^#/, ""));
  const res = await fetch(`${API_BASE}/api/alerts/${cleanId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch alert ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTransactions(ids: string[]): Promise<TransactionsResponse> {
  if (!ids || ids.length === 0) return { items: [], total: 0 };
  const query = new URLSearchParams({ ids: ids.join(",") });
  const res = await fetch(`${API_BASE}/api/transactions?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch transactions: ${res.statusText}`);
  }
  return res.json();
}

export async function startInvestigation(alertId: string): Promise<InvestigationResult> {
  const cleanId = encodeURIComponent(alertId.replace(/^#/, ""));
  const res = await fetch(`${API_BASE}/api/investigations/${cleanId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Failed to start investigation for alert ${alertId}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCaseSnapshot(caseIdOrAlertId: string): Promise<any> {
  const cleanId = encodeURIComponent(caseIdOrAlertId.replace(/^#/, ""));
  const res = await fetch(`${API_BASE}/api/cases/${cleanId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch case ${caseIdOrAlertId}: ${res.statusText}`);
  }
  return res.json();
}

export function getAuditReportUrl(alertId: string): string {
  const cleanId = encodeURIComponent(alertId.replace(/^#/, ""));
  return `${API_BASE}/api/investigations/${cleanId}/audit-report`;
}
