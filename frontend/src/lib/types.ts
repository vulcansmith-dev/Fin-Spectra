export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface PipelineSummary {
  accounts_ingested: number;
  transactions_ingested: number;
  raw_alerts_generated: number;
  raw_alerts_by_rule: Record<string, number>;
  accounts_with_alerts: number;
  classified_alerts_by_risk_level: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  status_counts?: Record<string, number>;
  prioritized_alerts_count?: number;
  pipeline_status?: string;
  last_run?: string;
  system_version?: string;
  aggregation_window?: string;
}

export interface ClassifiedAlert {
  classified_alert_id: string;
  alert_id?: string;
  account_id: string;
  customer_id?: string;
  transaction_ids: string[];
  alert_type: string;
  triggered_rules: string[];
  detected_reason: string;
  evidence: Record<string, any>;
  risk_score: number;
  risk_level: RiskLevel;
  timestamp: string;
  status: string;
  source_alert_ids?: string[];
  source?: string;
}

export interface Transaction {
  transaction_id: string;
  step: number;
  timestamp: string;
  source_account_id: string;
  dest_account_id: string;
  amount: number;
  currency: string;
}

export interface AlertsResponse {
  items: ClassifiedAlert[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionsResponse {
  items: Transaction[];
  total: number;
}

export interface InvestigationResult {
  status: string;
  case_id: string;
  alert_id: string;
  final_risk_score: number;
  decision: string;
  state: {
    case_id: string;
    alert_id: string;
    entity_id: string;
    alert_type: string;
    raw_priority_score: number;
    task_list?: Array<{ task_id: string; name: string; status: string }>;
    behavioral_metrics?: {
      velocity_z_score?: number;
      pass_through_ratio?: number;
      volume_surge_ratio?: number;
      historical_mean?: number;
      historical_std_dev?: number;
      historical_samples?: number;
      baseline_status?: string;
    };
    graph_metrics?: {
      account_count?: number;
      beneficiary_count?: number;
      device_count?: boolean;
      beneficiary_dispersion_ratio?: number;
      multi_beneficiary_flag?: boolean;
      multi_device_multi_beneficiary_flag?: boolean;
      self_transfer_detected?: boolean;
    };
    kyc_notes?: string;
    typology_classification?: string;
    typology_rationale?: string;
    forensic_questions?: Array<{ question: string; answer: string }>;
    investigation_plan?: string[];
    dossier?: string;
    final_risk_score?: number;
    decision?: string;
    trigger_evidence?: Record<string, any>;
  };
}
