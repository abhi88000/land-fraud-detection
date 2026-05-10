export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  gcs_path: string;
  content_type: string;
  status: DocumentStatus;
  state?: string;
  district?: string;
  land_type?: string;
  created_at: string;
  updated_at: string;
  progress_message?: string;
  progress_percentage?: number;
}

export interface Party {
  name: string;
  role: string;
}

export interface PropertyDetails {
  survey_numbers: string[];
  plot_numbers: string[];
  area: string;
  unit: string;
  address: string;
  city: string;
  district: string;
  state: string;
  land_type?: string;
}

export interface ExtractedData {
  document_type: string | null;
  party_names: Party[];
  property_details: PropertyDetails | null;
  dates: Record<string, string>;
  registration_info: any;
  stamp_duty_amount: string | null;
  signatures_present: boolean | null;
  document_language: string | null;
}

export interface LegalFinding {
  rule_id: string;
  description: string;
  is_compliant: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  remediation_suggestion: string | null;
}

export interface FraudFinding {
  fraud_type: string;
  description: string;
  is_suspicious: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
  recommendation: string | null;
}

export interface RiskScore {
  overall_score: number;
  category_scores: Record<string, number>;
}

export interface VerificationChecklistItem {
  item: string;
  is_checked: boolean;
  details?: string;
}

export interface AnalysisReport {
  document_id: string;
  summary: string;
  risk_score: RiskScore;
  extracted_data: ExtractedData;
  legal_findings: LegalFinding[];
  fraud_findings: FraudFinding[];
  verification_checklist: VerificationChecklistItem[];
  generated_at: string;
}

export interface AnalysisProgressEvent {
  event_type: string;
  data: any;
  message: string;
  progress: number;
  timestamp: string;
}
