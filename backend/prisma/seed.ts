/**
 * Sample data: fictional partners, kits, learning, funding and rewards.
 * Safe to re-run: it clears the tables first. Uploaded files are not removed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const json = (v: unknown) => JSON.stringify(v);

async function main() {
  // Clear in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.pointsEntry.deleteMany();
  await prisma.rewardItem.deleteMany();
  await prisma.benefitRequest.deleteMany();
  await prisma.benefitItem.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.campaignFile.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.fundingRequest.deleteMany();
  await prisma.kitCustomisation.deleteMany();
  await prisma.learningProgress.deleteMany();
  await prisma.learningModule.deleteMany();
  await prisma.campaignKit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.partner.deleteMany();

  // ---- Partners (fictional) ----
  const names = [
    'Northstar Technology', 'Atlas Digital', 'Bridgeway Systems', 'Cedar IT Solutions', 'Evergreen Computing',
    'Horizon Workplace', 'Meridian Infrastructure', 'Oakfield Technology', 'Summit Business IT',
  ];
  const focuses = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];
  const partners = [];
  for (const [i, name] of names.entries()) {
    partners.push(
      await prisma.partner.create({
        data: {
          code: `BP-${String(i + 1).padStart(3, '0')}`,
          name,
          contact: ['Alex Morgan', 'Jamie Taylor', 'Sam Patel'][i % 3],
          email: `partner${i + 1}@example.com`,
          focus: focuses[i % 3],
          segment: i < 3 ? 'Strategic' : 'Growth',
          owner: ['Jordan Lee', 'Casey Brooks', 'Robin Ellis'][i % 3],
          goal: 'Run one joint campaign and complete team enablement this quarter.',
          status: i === 8 ? 'Invited' : 'Active',
          annualBudget: 25000,
        },
      }),
    );
  }
  const northstar = partners[0];

  // ---- Users (demo credentials, stored as bcrypt hashes) ----
  const partnerUser = await prisma.user.create({
    data: { email: 'partner@demo.example', passwordHash: await bcrypt.hash('PartnerDemo26!', 10), name: 'Partner marketer', role: 'PARTNER', partnerId: northstar.id },
  });
  await prisma.user.create({
    data: { email: 'reviewer@demo.example', passwordHash: await bcrypt.hash('ReviewerDemo26!', 10), name: 'Programme reviewer', role: 'REVIEWER' },
  });

  // ---- Campaign kits ----
  const kitAssets = (n: number) =>
    json([
      { name: 'Campaign brief and execution checklist', detail: 'Approved master content', customisable: false },
      { name: 'Co-branded one-pager', detail: 'Editable partner details · PDF', customisable: true },
      { name: 'Email invitation and follow-up copy', detail: 'Approved master content', customisable: false },
      { name: 'Social visuals and copy', detail: 'Approved master content', customisable: false },
      { name: 'Presentation and facilitator guidance', detail: `Approved master content · ${n} assets in total`, customisable: false },
    ]);
  const common = { audience: 'Business & IT leaders', channel: 'Webinar + email', prepTime: '2–3 weeks', market: 'UK / English', version: '1.2', expiry: '31 December 2026' };
  const thinkpad = await prisma.campaignKit.create({
    data: { slug: 'thinkpad-workplace', code: '01', title: 'ThinkPad workplace', type: 'Business PCs', description: 'A webinar campaign exploring ThinkPad devices for modern workplaces.', assets: kitAssets(8), ...common },
  });
  await prisma.campaignKit.create({
    data: { slug: 'thinksystem-infrastructure', code: '02', title: 'ThinkSystem infrastructure', type: 'Infrastructure', description: 'A briefing campaign on infrastructure planning with ThinkSystem.', assets: kitAssets(6), ...common, channel: 'Customer briefing + email' },
  });
  const thinkstation = await prisma.campaignKit.create({
    data: { slug: 'thinkstation-creators', code: '03', title: 'ThinkStation for creators', type: 'Workstations', description: 'A webinar campaign exploring ThinkStation workstations for creative teams.', assets: kitAssets(7), ...common },
  });

  // ---- Enablement ----
  const modules = [
    {
      order: 1, title: 'Know the campaign audience', minutes: 5,
      body: 'Identify the business and IT leaders who own the problem this campaign explores, and what a good next step looks like for them.',
      checks: ['Name the job titles you will invite.', 'Write the problem in the customer’s words.', 'Pick one follow-up action.'],
      question: 'Who is the primary audience for these campaign kits?',
      options: [{ value: 'leaders', label: 'Business and IT decision-makers' }, { value: 'consumers', label: 'Home consumers' }],
      answer: 'leaders', hint: 'These kits target business and IT decision-makers. Try again.',
    },
    {
      order: 2, title: 'Use approved messaging', minutes: 5,
      body: 'Brand elements, product claims and disclaimers are locked. You can change only the permitted partner fields.',
      checks: ['Keep the approved headline and claims.', 'Add only your partner details and call to action.', 'Check links before export.'],
      question: 'Which parts of a campaign asset can you change?',
      options: [{ value: 'partner', label: 'Partner details and call to action' }, { value: 'claims', label: 'Product claims and disclaimers' }],
      answer: 'partner', hint: 'Only partner details and the call to action are editable. Try again.',
    },
    {
      order: 3, title: 'From campaign kit to customer conversation', minutes: 6,
      body: 'Define the audience and the problem you want to explore. Adapt only permitted fields and confirm your call to action before exporting the kit.',
      checks: ['Confirm the audience, activity date and campaign owner.', 'Obtain funding approval before committing eligible spend.', 'Plan your evidence: dated creative, delivery record, results and invoices.'],
      question: 'When should you request funding approval?',
      options: [{ value: 'before', label: 'Before committing campaign spend' }, { value: 'after', label: 'After submitting the claim' }],
      answer: 'before', hint: 'Funding approval should be requested before committing spend. Try again.',
    },
  ];
  const created = [];
  for (const m of modules) created.push(await prisma.learningModule.create({ data: { ...m, checks: json(m.checks), options: json(m.options) } }));
  for (const m of created.slice(0, 2)) await prisma.learningProgress.create({ data: { userId: partnerUser.id, moduleId: m.id } });

  // ---- Funding, campaigns and claims ----
  const mdf012 = await prisma.fundingRequest.create({
    data: {
      code: 'MDF-012', partnerId: northstar.id, title: 'ThinkSystem customer briefing', quarter: '2026-Q3', date: '2026-08-22', type: 'Customer event',
      objective: 'Brief 25 infrastructure owners on capacity planning.', eligibleCost: 14000, amount: 7000, status: 'Approved',
      submittedBy: partnerUser.id, submittedAt: new Date('2026-07-01'), decidedAt: new Date('2026-07-04'),
    },
  });
  const c012 = await prisma.campaign.create({ data: { fundingId: mdf012.id, startedAt: new Date('2026-07-10') } });
  await prisma.claim.create({ data: { code: 'CLM-012', campaignId: c012.id } });

  const mdf018 = await prisma.fundingRequest.create({
    data: {
      code: 'MDF-018', partnerId: northstar.id, kitId: thinkstation.id, title: 'ThinkStation creator webinar', quarter: '2026-Q3', date: '2026-09-10', type: 'Webinar',
      objective: 'Show ThinkStation workflows to 40 creative-team leads.', eligibleCost: 6000, amount: 3000, status: 'Approved',
      submittedBy: partnerUser.id, submittedAt: new Date('2026-07-20'), decidedAt: new Date('2026-07-23'),
    },
  });
  const c018 = await prisma.campaign.create({ data: { fundingId: mdf018.id, startedAt: new Date('2026-08-01') } });
  await prisma.claim.create({ data: { code: 'CLM-024', campaignId: c018.id } });

  await prisma.fundingRequest.create({
    data: {
      code: 'MDF-027', partnerId: northstar.id, kitId: thinkpad.id, title: 'ThinkPad workplace webinar', quarter: '2026-Q4', date: '2026-11-20', type: 'Webinar',
      objective: 'Introduce ThinkPad workplace scenarios to 40 IT and business decision-makers.', eligibleCost: 10000, amount: 5000, status: 'Draft',
    },
  });

  // ---- Benefits and rewards ----
  await prisma.benefitItem.createMany({
    data: [
      { name: 'Campaign planning workshop', description: 'A planning session to define your audience, activity and evidence checklist.', segment: 'All', limitText: 'One session per quarter' },
      { name: 'Co-marketing content review', description: 'A review of your proposed campaign creative and messaging.', segment: 'All', limitText: 'Two reviews per quarter' },
      { name: 'Solution demo session', description: 'A specialist-led demonstration for your customer campaign.', segment: 'Strategic', limitText: 'Subject to scheduling' },
    ],
  });
  await prisma.rewardItem.createMany({
    data: [
      { name: 'Training workshop credit', cost: 500 },
      { name: 'Campaign creative support', cost: 1000 },
      { name: 'Joint event planning session', cost: 1500 },
    ],
  });
  for (const [i, p] of partners.entries()) {
    await prisma.pointsEntry.create({ data: { partnerId: p.id, kind: 'earn', points: 1500 + i * 100, reason: 'Opening balance', status: 'Approved' } });
  }

  console.log('Seeded: 9 partners, 2 users, 3 kits, 3 modules, 3 funding requests, benefits and rewards.');
  console.log('  partner@demo.example / PartnerDemo26!');
  console.log('  reviewer@demo.example / ReviewerDemo26!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
