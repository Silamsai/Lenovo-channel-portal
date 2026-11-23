'use server';

/**
 * Server Actions: every form in the portal posts to one of these. They run on the Next.js
 * server, call the backend API with the user's session token, then re-render or redirect.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { API_URL, SESSION_COOKIE, apiSend } from './api';
import type { User } from './types';

export interface FormState {
  error?: string;
  ok?: string;
  at?: number;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => (fd.get(k) === null || str(fd, k) === '' ? NaN : Number(fd.get(k)));
const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
const intent = (fd: FormData) => str(fd, 'intent');

/** Runs a backend call; on success refreshes the pages and optionally redirects. */
async function run(fn: () => Promise<unknown>, ok?: string, to?: string): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong.', at: Date.now() };
  }
  revalidatePath('/', 'layout');
  if (to) redirect(to);
  return { ok, at: Date.now() };
}

// ---------- Session ----------

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  let user: User;
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: str(fd, 'email'), password: String(fd.get('password') ?? '') }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? 'Sign-in failed.', at: Date.now() };
    (await cookies()).set(SESSION_COOKIE, data.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: data.expiresIn,
    });
    user = data.user;
  } catch {
    return { error: 'The backend API is not reachable. Is it running?', at: Date.now() };
  }
  redirect(user.role === 'ADMIN' ? '/admin' : '/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function markNotificationsRead() {
  await apiSend('POST', '/notifications/read').catch(() => undefined);
  revalidatePath('/', 'layout');
}

// ---------- Funding ----------

export async function saveFunding(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const submit = intent(fd) === 'submit';
  const body = {
    title: str(fd, 'title'),
    kitId: str(fd, 'kitId') ? Number(str(fd, 'kitId')) : null,
    quarter: str(fd, 'quarter'),
    date: str(fd, 'date'),
    type: str(fd, 'type'),
    objective: str(fd, 'objective'),
    eligibleCost: num(fd, 'eligibleCost'),
    amount: num(fd, 'amount'),
    submit,
    attest: bool(fd, 'attest'),
  };
  if (!Number.isFinite(body.eligibleCost) || !Number.isFinite(body.amount)) return { error: 'Enter the eligible cost and the funding you are requesting.', at: Date.now() };
  let savedId = id;
  const result = await run(async () => {
    const saved = await apiSend<{ id: number }>(id ? 'PUT' : 'POST', id ? `/funding/${id}` : '/funding', body);
    savedId = saved.id;
  }, submit ? 'Funding request submitted for programme review.' : 'Draft saved.');
  if (!result.error && !id && savedId) redirect(`/funding/${savedId}`);
  return result;
}

export async function decideFunding(id: number, _prev: FormState, fd: FormData) {
  const decision = intent(fd);
  return run(() => apiSend('POST', `/funding/${id}/decision`, { decision, note: str(fd, 'note') }), `Decision recorded: ${decision}.`);
}

export async function startCampaign(id: number, _prev: FormState) {
  return run(() => apiSend('POST', `/funding/${id}/start`), undefined, `/campaigns/${id}/3`);
}

// ---------- Campaign: assets, performance, evidence, claim ----------

export async function uploadAssets(fid: number, _prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', `/campaigns/${fid}/assets`, fd), 'Assets uploaded.');
}

export async function removeAsset(fid: number, fileId: number, _prev: FormState) {
  return run(() => apiSend('DELETE', `/campaigns/${fid}/assets/${fileId}`), 'File removed.');
}

export async function submitAssets(fid: number, _prev: FormState) {
  return run(() => apiSend('POST', `/campaigns/${fid}/assets/submit`), 'Assets submitted for approval.');
}

export async function decideAssets(fid: number, _prev: FormState, fd: FormData) {
  const decision = intent(fd);
  return run(() => apiSend('POST', `/campaigns/${fid}/assets/decision`, { decision, note: str(fd, 'note') }), `Assets: ${decision}.`);
}

export async function savePerformance(fid: number, fields: string[], _prev: FormState, fd: FormData) {
  const complete = intent(fd) === 'complete';
  const metrics = Object.fromEntries(fields.map((k) => [k, str(fd, `m_${k}`)]));
  return run(
    () => apiSend('PUT', `/campaigns/${fid}/performance`, { metrics, spend: str(fd, 'spend'), complete }),
    complete ? 'Campaign completed with all results.' : 'Performance saved.',
  );
}

export async function uploadEvidence(fid: number, kind: string, _prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', `/campaigns/${fid}/evidence/${kind}`, fd), 'Evidence uploaded.');
}

export async function removeEvidence(fid: number, fileId: number, _prev: FormState) {
  return run(() => apiSend('DELETE', `/campaigns/${fid}/evidence/${fileId}`), 'File removed.');
}

export async function saveClaim(fid: number, _prev: FormState, fd: FormData) {
  const submit = intent(fd) === 'submit';
  return run(
    () => apiSend('PUT', `/campaigns/${fid}/claim`, { amount: num(fd, 'amount'), attested: bool(fd, 'attested'), submit }),
    submit ? 'Claim submitted for review.' : 'Claim saved.',
  );
}

export async function decideClaim(fid: number, _prev: FormState, fd: FormData) {
  const decision = intent(fd);
  return run(() => apiSend('POST', `/campaigns/${fid}/claim/decision`, { decision, note: str(fd, 'note') }), `Claim: ${decision}.`);
}

export async function recordPayment(fid: number, _prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', `/campaigns/${fid}/claim/payment`, { reference: str(fd, 'reference'), date: str(fd, 'date') }), 'Payment recorded.');
}

// ---------- Kits and enablement ----------

export async function saveCustomisation(slug: string, _prev: FormState, fd: FormData) {
  return run(
    () => apiSend('PUT', `/kits/${slug}/customisation`, { company: str(fd, 'company'), contactEmail: str(fd, 'contactEmail'), cta: str(fd, 'cta'), url: str(fd, 'url') }),
    'Customisation saved.',
  );
}

export async function completeModule(id: number, _prev: FormState, fd: FormData) {
  if (!str(fd, 'answer')) return { error: 'Choose an answer.', at: Date.now() };
  return run(() => apiSend('POST', `/enablement/${id}/complete`, { answer: str(fd, 'answer') }), 'Module completed.');
}

// ---------- Partner programme ----------

export async function saveProfile(key: string, _prev: FormState, fd: FormData) {
  return run(
    () => apiSend('PUT', `/partners/${key}`, { name: str(fd, 'name'), contact: str(fd, 'contact'), email: str(fd, 'email'), focus: str(fd, 'focus'), goal: str(fd, 'goal') }),
    'Profile saved.',
  );
}

export async function requestBenefit(id: number, _prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', `/benefits/${id}/request`, { note: str(fd, 'note') }), undefined, '/benefits?sent=1');
}

export async function decideBenefit(id: number, _prev: FormState, fd: FormData) {
  const decision = intent(fd);
  return run(() => apiSend('POST', `/benefits/requests/${id}/decision`, { decision, note: str(fd, 'note') }), `Decision recorded: ${decision}.`);
}

export async function earnPoints(_prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', '/rewards/earn', { activity: str(fd, 'activity'), evidence: str(fd, 'evidence') }), 'Activity submitted for points approval.');
}

export async function redeemReward(id: number, _prev: FormState) {
  return run(() => apiSend('POST', `/rewards/${id}/redeem`), 'Redemption requested.');
}

export async function decidePoints(id: number, _prev: FormState, fd: FormData) {
  const decision = intent(fd);
  return run(() => apiSend('POST', `/rewards/entries/${id}/decision`, { decision, note: str(fd, 'note') }), `Decision recorded: ${decision}.`);
}

// ---------- Platform admin ----------

const userBody = (fd: FormData) => ({
  name: str(fd, 'name'),
  email: str(fd, 'email'),
  role: str(fd, 'role'),
  partnerId: str(fd, 'role') === 'PARTNER' && str(fd, 'partnerId') ? Number(str(fd, 'partnerId')) : null,
});

export async function createUser(_prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', '/admin/users', { ...userBody(fd), password: String(fd.get('password') ?? '') }), undefined, '/admin/users?saved=created');
}

export async function updateUser(id: number, isSelf: boolean, _prev: FormState, fd: FormData) {
  return run(() => apiSend('PUT', `/admin/users/${id}`, { ...userBody(fd), active: isSelf ? true : bool(fd, 'active') }), undefined, '/admin/users?saved=updated');
}

export async function resetPassword(id: number, _prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', `/admin/users/${id}/password`, { password: String(fd.get('password') ?? '') }), 'Password reset. Share it with the user securely.');
}

export async function deleteUser(id: number, _prev: FormState) {
  return run(() => apiSend('DELETE', `/admin/users/${id}`), undefined, '/admin/users?saved=deleted');
}

const partnerBody = (fd: FormData) => ({
  name: str(fd, 'name'),
  contact: str(fd, 'contact'),
  email: str(fd, 'email'),
  focus: str(fd, 'focus'),
  segment: str(fd, 'segment'),
  owner: str(fd, 'owner'),
  status: str(fd, 'status'),
  annualBudget: str(fd, 'annualBudget') === '' ? null : Number(str(fd, 'annualBudget')),
});

export async function createPartner(_prev: FormState, fd: FormData) {
  return run(() => apiSend('POST', '/admin/partners', partnerBody(fd)), undefined, '/admin/users?tab=partners&saved=created');
}

export async function updatePartner(id: number, _prev: FormState, fd: FormData) {
  return run(() => apiSend('PUT', `/admin/partners/${id}`, partnerBody(fd)), undefined, '/admin/users?tab=partners&saved=updated');
}

export async function saveSettings(_prev: FormState, fd: FormData) {
  return run(
    () =>
      apiSend('PUT', '/admin/settings', {
        programmeName: str(fd, 'programmeName'),
        contributionPercent: num(fd, 'contributionPercent'),
        maxRequestGbp: num(fd, 'maxRequestGbp'),
        defaultAnnualBudget: num(fd, 'defaultAnnualBudget'),
        pointsPerActivity: num(fd, 'pointsPerActivity'),
        pointsPerApprovedClaim: num(fd, 'pointsPerApprovedClaim'),
      }),
    'Settings saved. New limits apply immediately.',
  );
}

