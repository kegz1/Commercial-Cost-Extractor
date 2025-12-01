export interface POData {
  po_number: string;
  qty: number;
  value: number;
}

export interface ValidationStatus {
  qty_match: boolean;
  value_match: boolean;
  qty_variance: number;
  value_variance: number;
  details?: string;
}

export interface ExtractionResult {
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  document_format: 'Type A' | 'Type B' | 'Type C' | 'Unknown';
  po_breakdown: POData[];
  total_qty: number;
  total_value: number;
  validation: ValidationStatus;
  confidence_score: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
  other_charges_value?: number;
}

export interface AppState {
  apiKey: string;
  file: File | null;
  previewUrl: string | null;
  isProcessing: boolean;
  result: ExtractionResult | null;
  error: string | null;
}
