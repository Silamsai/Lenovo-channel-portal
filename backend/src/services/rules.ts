/**
 * Every programme rule lives here, so they are easy to find and change.
 * Limits come from the admin-managed settings (services/settings.ts).
 * The client pre-checks some of these for quick feedback; the backend is the authority.
 */
import { settings } from './settings';

const share = () => settings().contributionPercent / 100;

export const CAMPAIGN_TYPES = ['Webinar', 'Customer event', 'Email campaign', 'Digital campaign'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const EVIDENCE_KINDS = ['delivery', 'performance', 'invoices'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  delivery: 'Delivery evidence',
  performance: 'Performance report',
  invoices: 'Invoices',
};

export const METRIC_FIELDS: Record<CampaignType, [string, string][]> = {
  Webinar: [['registrations', 'Registrations'], ['attendees', 'Attendees'], ['leads', 'Qualified leads'], ['meetings', 'Follow-up meetings']],
  'Customer event': [['registrations', 'Registrations'], ['attendees', 'Attendees'], ['leads', 'Qualified leads'], ['meetings', 'Follow-up meetings']],
  'Email campaign': [['sent', 'Emails sent'], ['delivered', 'Emails delivered'], ['opens', 'Unique opens'], ['clicks', 'Unique clicks'], ['leads', 'Qualified leads']],
  'Digital campaign': [['impressions', 'Impressions'], ['clicks', 'Clicks'], ['leads', 'Qualified leads'], ['conversions', 'Conversions']],
};

/** Statuses after which a submission can no longer be edited by the partner. */
export const LOCKED = ['Submitted', 'Approved', 'Rejected'];
export const isLocked = (status: string) => LOCKED.includes(status);

export const quarterOf = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(0, 4)}-Q${Math.ceil(Number(date.slice(5, 7)) / 3)}` : '';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const gbp = (n: number) => '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 2 });

export function fundingProblem(input: { quarter: string; date: string; eligibleCost: number; amount: number }, available: number): string {
  if (quarterOf(input.date) !== input.quarter) return 'The execution date must fall within the selected funding quarter.';
  if (!(input.eligibleCost > 0)) return 'Eligible cost must be greater than zero.';
  if (!(input.amount > 0)) return 'Requested funding must be greater than zero.';
  if (input.amount > input.eligibleCost * share()) return `Requested funding must be at most ${settings().contributionPercent}% of eligible cost.`;
  if (input.amount > settings().maxRequestGbp) return `Requested funding must be at most ${gbp(settings().maxRequestGbp)}.`;
  if (input.amount > available) return `Requested funding exceeds the available budget of ${gbp(available)}.`;
  return '';
}

export function resultsProblem(type: string, values: Record<string, unknown>, spend: unknown): string {
  const fields = METRIC_FIELDS[type as CampaignType];
  if (!fields) return 'Unknown campaign type.';
  const keys = fields.map(([k]) => k);
  const num = (k: string) => Number(values[k]);
  const missing = (v: unknown) => v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0;
  if (keys.some((k) => missing(values[k])) || missing(spend)) return 'Complete every required result. Enter 0 where there was no activity.';
  if (keys.some((k) => !Number.isInteger(num(k)))) return 'Counts must be whole numbers.';
  const exceeds = (a: string, b: string) => num(a) > num(b);
  if ((type === 'Webinar' || type === 'Customer event') && (exceeds('attendees', 'registrations') || exceeds('leads', 'attendees') || exceeds('meetings', 'leads')))
    return 'Use a consistent funnel: registrations ≥ attendees ≥ qualified leads ≥ follow-up meetings.';
  if (type === 'Email campaign' && (exceeds('delivered', 'sent') || exceeds('opens', 'delivered') || exceeds('clicks', 'delivered') || exceeds('leads', 'clicks')))
    return 'Delivered cannot exceed sent; unique opens and clicks cannot exceed delivered; leads cannot exceed clicks.';
  if (type === 'Digital campaign' && (exceeds('clicks', 'impressions') || exceeds('leads', 'clicks') || exceeds('conversions', 'leads')))
    return 'Use a consistent funnel: impressions ≥ clicks ≥ qualified leads ≥ conversions.';
  return '';
}

/** Maximum claim: the contribution share of actual eligible spend, capped at the approved allocation. */
export const claimLimit = (approved: number, spend: number | null | undefined) => round2(Math.min(approved, Number(spend || 0) * share()));
