export type Role = 'PARTNER' | 'REVIEWER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  partner: { id: number; name: string; code: string; segment: string } | null;
}

export interface FileInfo {
  id: number;
  kind: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
}

export type EvidenceKind = 'delivery' | 'performance' | 'invoices';

export interface ClaimInfo {
  id: number;
  code: string;
  amount: number | null;
  attested: boolean;
  status: string;
  note: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  limit: number;
}

export interface CampaignInfo {
  id: number;
  startedAt: string;
  completedAt: string | null;
  metrics: Record<string, number | string>;
  metricFields: [string, string][];
  actualSpend: number | null;
  resultsReady: boolean;
  assetStatus: string;
  assetVersion: number;
  assetNote: string | null;
  assetsApproved: boolean;
  assets: FileInfo[];
  evidence: Record<EvidenceKind, FileInfo[]>;
  evidenceComplete: boolean;
  claim: ClaimInfo | null;
}

export interface Funding {
  id: number;
  code: string;
  partner: { id: number; name: string; code: string };
  kitId: number | null;
  title: string;
  quarter: string;
  date: string;
  type: CampaignType;
  objective: string;
  eligibleCost: number;
  amount: number;
  status: string;
  feedback: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
  campaign: CampaignInfo | null;
}

export interface Budget {
  budget: number;
  approved: number;
  pending: number;
  available: number;
}

export interface HistoryEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  by: string;
}

export type CampaignType = 'Webinar' | 'Customer event' | 'Email campaign' | 'Digital campaign';

export interface Kit {
  id: number;
  slug: string;
  code: string;
  title: string;
  type: string;
  description: string;
  audience: string;
  channel: string;
  prepTime: string;
  market: string;
  version: string;
  expiry: string;
  assets: { name: string; detail: string; customisable: boolean }[];
}

export interface Customisation {
  company: string;
  contactEmail: string;
  cta: string;
  url: string;
}

export interface LearningModule {
  id: number;
  order: number;
  title: string;
  minutes: number;
  body: string;
  checks: string[];
  question: string;
  options: { value: string; label: string }[];
  completed: boolean;
}

export interface Partner {
  id: number;
  code: string;
  name: string;
  contact: string;
  email: string;
  focus: string;
  segment: string;
  owner: string;
  goal: string;
  status: string;
  annualBudget: number;
  points: number;
  pendingBenefits?: number;
}

export interface Report {
  totals: {
    requested: number;
    approved: number;
    kitExports: number;
    launched: number;
    completed: number;
    claimsApproved: number;
    paid: number;
  };
  campaigns: {
    id: number;
    code: string;
    title: string;
    partner: string;
    quarter: string;
    type: string;
    amount: number;
    readiness: number;
    resultsReady: boolean;
    metrics: { label: string; value: number | string | null }[];
    actualSpend: number | null;
    claimStatus: string | null;
    claimAmount: number | null;
    paid: boolean;
  }[];
}

export interface ReviewQueue {
  funding: (Funding & { available: number })[];
  assets: Funding[];
  claims: Funding[];
  payments: Funding[];
  benefits: { id: number; partner: string; benefit: string; note: string; createdAt: string }[];
  points: { id: number; partner: string; kind: string; points: number; reason: string; evidence: string | null; createdAt: string }[];
}
