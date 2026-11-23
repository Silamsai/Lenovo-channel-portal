export const money = (n: number | null | undefined) =>
  '£' + Number(n ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

export const quarterLabel = (q: string) => q.replace(/(\d{4})-Q(\d)/, 'Q$2 $1');

export const QUARTERS = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4'];

export const quarterOf = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(0, 4)}-Q${Math.ceil(Number(d.slice(5, 7)) / 3)}` : '';

export const fileSize = (n: number) => (n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');

export const dateLabel = (d: string | null | undefined) => {
  if (!d) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const CAMPAIGN_TYPES = ['Webinar', 'Customer event', 'Email campaign', 'Digital campaign'] as const;

export const EVIDENCE: { kind: 'delivery' | 'performance' | 'invoices'; label: string }[] = [
  { kind: 'delivery', label: 'Delivery evidence' },
  { kind: 'performance', label: 'Performance report' },
  { kind: 'invoices', label: 'Invoices' },
];
