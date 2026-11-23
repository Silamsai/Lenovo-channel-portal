import { db } from '../db';

/**
 * Programme settings the platform admin can change.
 * Cached in memory so rules can read them synchronously; reloaded on startup and after each save.
 */
export interface ProgrammeSettings {
  programmeName: string;
  contributionPercent: number; // max share of eligible cost / actual spend the vendor funds
  maxRequestGbp: number; // max per funding request
  defaultAnnualBudget: number; // budget given to new partner organisations
  pointsPerActivity: number; // points for an approved partner activity
  pointsPerApprovedClaim: number; // points awarded when a claim is approved
}

export const DEFAULT_SETTINGS: ProgrammeSettings = {
  programmeName: 'Partner programme',
  contributionPercent: 50,
  maxRequestGbp: 15000,
  defaultAnnualBudget: 25000,
  pointsPerActivity: 250,
  pointsPerApprovedClaim: 250,
};

let cache: ProgrammeSettings = { ...DEFAULT_SETTINGS };

export const settings = () => cache;

export async function loadSettings() {
  const rows = await db.many<{ key: string; value: string }>('SELECT key, value FROM settings');
  const next: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    const key = row.key as keyof ProgrammeSettings;
    next[key] = typeof DEFAULT_SETTINGS[key] === 'number' ? Number(row.value) : row.value;
  }
  cache = next as unknown as ProgrammeSettings;
  return cache;
}

export async function saveSettings(values: ProgrammeSettings) {
  await db.tx(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx.run(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, String(value)],
      );
    }
  });
  return loadSettings();
}
