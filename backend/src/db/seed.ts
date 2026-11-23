/**
 * Sample data: fictional partners, kits, learning, funding and rewards, plus the three sign-ins.
 * Safe to re-run: it empties the tables first. Usage: npm run db:seed
 */
import bcrypt from 'bcryptjs';
import { db } from './index';
import { migrate } from './migrate';

const json = (v: unknown) => JSON.stringify(v);

async function main() {
  await migrate(false);
  await db.script(`TRUNCATE audit_log, settings, points_entries, reward_items, benefit_requests, benefit_items, claims, campaign_files,
    campaigns, funding_requests, kit_customisations, learning_progress, learning_modules, campaign_kits, users, partners RESTART IDENTITY CASCADE`);

  await db.tx(async (tx) => {
    // ---- Partners (fictional) ----
    const names = ['Northstar Technology', 'Atlas Digital', 'Bridgeway Systems', 'Cedar IT Solutions', 'Evergreen Computing', 'Horizon Workplace', 'Meridian Infrastructure', 'Oakfield Technology', 'Summit Business IT'];
    const focuses = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];
    const partnerIds: number[] = [];
    for (const [i, name] of names.entries()) {
      const p = await tx.one(
        `INSERT INTO partners (code, name, contact, email, focus, segment, owner, goal, status, annual_budget)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,25000) RETURNING id`,
        [
          `BP-${String(i + 1).padStart(3, '0')}`,
          name,
          ['Alex Morgan', 'Jamie Taylor', 'Sam Patel'][i % 3],
          `partner${i + 1}@example.com`,
          focuses[i % 3],
          i < 3 ? 'Strategic' : 'Growth',
          ['Jordan Lee', 'Casey Brooks', 'Robin Ellis'][i % 3],
          'Run one joint campaign and complete team enablement this quarter.',
          i === 8 ? 'Invited' : 'Active',
        ],
      );
      partnerIds.push(p.id);
    }
    const northstar = partnerIds[0];

    // ---- Users (passwords stored as bcrypt hashes) ----
    const user = async (email: string, pw: string, name: string, role: string, partnerId: number | null) =>
      (await tx.one('INSERT INTO users (email, password_hash, name, role, partner_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [email, await bcrypt.hash(pw, 10), name, role, partnerId])).id as number;
    const partnerUser = await user('partner@demo.example', 'PartnerDemo26!', 'Partner marketer', 'PARTNER', northstar);
    await user('reviewer@demo.example', 'ReviewerDemo26!', 'Programme reviewer', 'REVIEWER', null);
    await user('admin@lenovo.com', 'lenovo@2026', 'Platform admin', 'ADMIN', null);

    // ---- Campaign kits ----
    const kitAssets = (n: number) =>
      json([
        { name: 'Campaign brief and execution checklist', detail: 'Approved master content', customisable: false },
        { name: 'Co-branded one-pager', detail: 'Editable partner details · PDF', customisable: true },
        { name: 'Email invitation and follow-up copy', detail: 'Approved master content', customisable: false },
        { name: 'Social visuals and copy', detail: 'Approved master content', customisable: false },
        { name: 'Presentation and facilitator guidance', detail: `Approved master content · ${n} assets in total`, customisable: false },
      ]);
    const kit = async (slug: string, code: string, title: string, type: string, description: string, channel: string, n: number) =>
      (
        await tx.one(
          `INSERT INTO campaign_kits (slug, code, title, type, description, audience, channel, prep_time, market, version, expiry, assets)
           VALUES ($1,$2,$3,$4,$5,'Business & IT leaders',$6,'2–3 weeks','UK / English','1.2','31 December 2026',$7::jsonb) RETURNING id`,
          [slug, code, title, type, description, channel, kitAssets(n)],
        )
      ).id as number;
    const thinkpad = await kit('thinkpad-workplace', '01', 'ThinkPad workplace', 'Business PCs', 'A webinar campaign exploring ThinkPad devices for modern workplaces.', 'Webinar + email', 8);
    await kit('thinksystem-infrastructure', '02', 'ThinkSystem infrastructure', 'Infrastructure', 'A briefing campaign on infrastructure planning with ThinkSystem.', 'Customer briefing + email', 6);
    const thinkstation = await kit('thinkstation-creators', '03', 'ThinkStation for creators', 'Workstations', 'A webinar campaign exploring ThinkStation workstations for creative teams.', 'Webinar + email', 7);

    // ---- Enablement ----
    const modules = [
      {
        title: 'Know the campaign audience', minutes: 5,
        body: 'Identify the business and IT leaders who own the problem this campaign explores, and what a good next step looks like for them.',
        checks: ['Name the job titles you will invite.', 'Write the problem in the customer’s words.', 'Pick one follow-up action.'],
        question: 'Who is the primary audience for these campaign kits?',
        options: [{ value: 'leaders', label: 'Business and IT decision-makers' }, { value: 'consumers', label: 'Home consumers' }],
        answer: 'leaders', hint: 'These kits target business and IT decision-makers. Try again.',
      },
      {
        title: 'Use approved messaging', minutes: 5,
        body: 'Brand elements, product claims and disclaimers are locked. You can change only the permitted partner fields.',
        checks: ['Keep the approved headline and claims.', 'Add only your partner details and call to action.', 'Check links before export.'],
        question: 'Which parts of a campaign asset can you change?',
        options: [{ value: 'partner', label: 'Partner details and call to action' }, { value: 'claims', label: 'Product claims and disclaimers' }],
        answer: 'partner', hint: 'Only partner details and the call to action are editable. Try again.',
      },
      {
        title: 'From campaign kit to customer conversation', minutes: 6,
        body: 'Define the audience and the problem you want to explore. Adapt only permitted fields and confirm your call to action before exporting the kit.',
        checks: ['Confirm the audience, activity date and campaign owner.', 'Obtain funding approval before committing eligible spend.', 'Plan your evidence: dated creative, delivery record, results and invoices.'],
        question: 'When should you request funding approval?',
        options: [{ value: 'before', label: 'Before committing campaign spend' }, { value: 'after', label: 'After submitting the claim' }],
        answer: 'before', hint: 'Funding approval should be requested before committing spend. Try again.',
      },
    ];
    for (const [i, m] of modules.entries()) {
      const row = await tx.one(
        `INSERT INTO learning_modules (sort_order, title, minutes, body, checks, question, options, answer, hint)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9) RETURNING id`,
        [i + 1, m.title, m.minutes, m.body, json(m.checks), m.question, json(m.options), m.answer, m.hint],
      );
      if (i < 2) await tx.run('INSERT INTO learning_progress (user_id, module_id) VALUES ($1, $2)', [partnerUser, row.id]);
    }

    // ---- Funding, campaigns and claims ----
    const funding = async (v: unknown[]) =>
      (
        await tx.one(
          `INSERT INTO funding_requests (code, partner_id, kit_id, title, quarter, date, type, objective, eligible_cost, amount, status, submitted_by, submitted_at, decided_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          v,
        )
      ).id as number;
    const startCampaign = async (fundingId: number, claimCode: string, started: string) => {
      const c = await tx.one('INSERT INTO campaigns (funding_id, started_at) VALUES ($1, $2) RETURNING id', [fundingId, started]);
      await tx.run('INSERT INTO claims (code, campaign_id) VALUES ($1, $2)', [claimCode, c.id]);
    };
    const f012 = await funding(['MDF-012', northstar, null, 'ThinkSystem customer briefing', '2026-Q3', '2026-08-22', 'Customer event', 'Brief 25 infrastructure owners on capacity planning.', 14000, 7000, 'Approved', partnerUser, '2026-07-01', '2026-07-04']);
    await startCampaign(f012, 'CLM-012', '2026-07-10');
    const f018 = await funding(['MDF-018', northstar, thinkstation, 'ThinkStation creator webinar', '2026-Q3', '2026-09-10', 'Webinar', 'Show ThinkStation workflows to 40 creative-team leads.', 6000, 3000, 'Approved', partnerUser, '2026-07-20', '2026-07-23']);
    await startCampaign(f018, 'CLM-024', '2026-08-01');
    await funding(['MDF-027', northstar, thinkpad, 'ThinkPad workplace webinar', '2026-Q4', '2026-11-20', 'Webinar', 'Introduce ThinkPad workplace scenarios to 40 IT and business decision-makers.', 10000, 5000, 'Draft', null, null, null]);

    // ---- Benefits and rewards ----
    for (const [name, description, segment, limitText] of [
      ['Campaign planning workshop', 'A planning session to define your audience, activity and evidence checklist.', 'All', 'One session per quarter'],
      ['Co-marketing content review', 'A review of your proposed campaign creative and messaging.', 'All', 'Two reviews per quarter'],
      ['Solution demo session', 'A specialist-led demonstration for your customer campaign.', 'Strategic', 'Subject to scheduling'],
    ])
      await tx.run('INSERT INTO benefit_items (name, description, segment, limit_text) VALUES ($1,$2,$3,$4)', [name, description, segment, limitText]);
    for (const [name, cost] of [['Training workshop credit', 500], ['Campaign creative support', 1000], ['Joint event planning session', 1500]] as const)
      await tx.run('INSERT INTO reward_items (name, cost) VALUES ($1, $2)', [name, cost]);
    for (const [i, id] of partnerIds.entries())
      await tx.run(`INSERT INTO points_entries (partner_id, kind, points, reason, status) VALUES ($1, 'earn', $2, 'Opening balance', 'Approved')`, [id, 1500 + i * 100]);
  });

  console.log(`Seeded: 9 partners, 3 users, 3 kits, 3 modules, 3 funding requests, benefits and rewards.`);
  console.log('  partner@demo.example / PartnerDemo26!');
  console.log('  reviewer@demo.example / ReviewerDemo26!');
  console.log('  admin@lenovo.com / lenovo@2026 (platform admin)');
}

main()
  .then(() => db.close())
  .catch(async (e) => {
    console.error(e);
    await db.close();
    process.exit(1);
  });
