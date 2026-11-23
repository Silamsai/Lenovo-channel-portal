-- Channel Studio schema (PostgreSQL). Works on Neon or any PostgreSQL server.

CREATE TABLE partners (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,            -- BP-001
  name          TEXT NOT NULL,
  contact       TEXT NOT NULL,
  email         TEXT NOT NULL,
  focus         TEXT NOT NULL,
  segment       TEXT NOT NULL,                   -- Strategic | Growth
  owner         TEXT NOT NULL,                   -- programme owner on the vendor side
  goal          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Active',  -- Active | Invited | Suspended
  annual_budget DOUBLE PRECISION NOT NULL DEFAULT 25000,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('PARTNER', 'REVIEWER', 'ADMIN')),
  partner_id            INTEGER REFERENCES partners(id),
  active                BOOLEAN NOT NULL DEFAULT true,
  last_login_at         TIMESTAMPTZ,
  notifications_seen_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_kits (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  audience    TEXT NOT NULL,
  channel     TEXT NOT NULL,
  prep_time   TEXT NOT NULL,
  market      TEXT NOT NULL,
  version     TEXT NOT NULL,
  expiry      TEXT NOT NULL,
  assets      JSONB NOT NULL                     -- [{ name, detail, customisable }]
);

CREATE TABLE kit_customisations (
  id            SERIAL PRIMARY KEY,
  kit_id        INTEGER NOT NULL REFERENCES campaign_kits(id),
  partner_id    INTEGER NOT NULL REFERENCES partners(id),
  company       TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  cta           TEXT NOT NULL,
  url           TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kit_id, partner_id)
);

CREATE TABLE learning_modules (
  id         SERIAL PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  title      TEXT NOT NULL,
  minutes    INTEGER NOT NULL,
  body       TEXT NOT NULL,
  checks     JSONB NOT NULL,                     -- string[]
  question   TEXT NOT NULL,
  options    JSONB NOT NULL,                     -- [{ value, label }]
  answer     TEXT NOT NULL,
  hint       TEXT NOT NULL
);

CREATE TABLE learning_progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id    INTEGER NOT NULL REFERENCES learning_modules(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id)
);

CREATE TABLE funding_requests (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,            -- MDF-027
  partner_id    INTEGER NOT NULL REFERENCES partners(id),
  kit_id        INTEGER REFERENCES campaign_kits(id),
  title         TEXT NOT NULL,
  quarter       TEXT NOT NULL,                   -- 2026-Q4
  date          TEXT NOT NULL,                   -- YYYY-MM-DD planned execution date
  type          TEXT NOT NULL,                   -- Webinar | Customer event | Email campaign | Digital campaign
  objective     TEXT NOT NULL,
  eligible_cost DOUBLE PRECISION NOT NULL,
  amount        DOUBLE PRECISION NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Submitted | Approved | Changes requested | Rejected
  feedback      TEXT,
  submitted_by  INTEGER,
  decided_by    INTEGER,
  submitted_at  TIMESTAMPTZ,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX funding_partner_idx ON funding_requests (partner_id);

CREATE TABLE campaigns (
  id            SERIAL PRIMARY KEY,
  funding_id    INTEGER NOT NULL UNIQUE REFERENCES funding_requests(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  metrics       JSONB,                           -- counts required for the campaign type
  actual_spend  DOUBLE PRECISION,
  asset_status  TEXT NOT NULL DEFAULT 'Draft',   -- Draft | Submitted | Approved | Changes requested
  asset_version INTEGER NOT NULL DEFAULT 1,
  asset_note    TEXT,
  asset_by      INTEGER                          -- who submitted the current asset version
);

-- Campaign assets (kind = asset) and proof-of-execution evidence (delivery | performance | invoices).
CREATE TABLE campaign_files (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  name        TEXT NOT NULL,
  stored_as   TEXT NOT NULL,
  size        INTEGER NOT NULL,
  mime        TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX campaign_files_campaign_idx ON campaign_files (campaign_id);

CREATE TABLE claims (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,             -- CLM-024
  campaign_id  INTEGER NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  amount       DOUBLE PRECISION,
  attested     BOOLEAN NOT NULL DEFAULT false,
  status       TEXT NOT NULL DEFAULT 'Draft',
  note         TEXT,
  submitted_by INTEGER,
  decided_by   INTEGER,
  submitted_at TIMESTAMPTZ,
  decided_at   TIMESTAMPTZ,
  payment_ref  TEXT,
  paid_at      TEXT,
  paid_by      INTEGER
);

CREATE TABLE benefit_items (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  segment     TEXT NOT NULL,                     -- All | Strategic
  limit_text  TEXT NOT NULL
);

CREATE TABLE benefit_requests (
  id            SERIAL PRIMARY KEY,
  partner_id    INTEGER NOT NULL REFERENCES partners(id),
  benefit_id    INTEGER NOT NULL REFERENCES benefit_items(id),
  note          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reward_items (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL
);

-- Points ledger: earn entries positive, redemptions negative. Balance = sum of approved entries.
CREATE TABLE points_entries (
  id            SERIAL PRIMARY KEY,
  partner_id    INTEGER NOT NULL REFERENCES partners(id),
  kind          TEXT NOT NULL,                   -- earn | redeem
  points        INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  evidence      TEXT,
  reward_id     INTEGER REFERENCES reward_items(id),
  status        TEXT NOT NULL DEFAULT 'Pending',
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER,
  entity      TEXT NOT NULL,                     -- funding | assets | claim | benefit | points | kit | partner | user | settings
  entity_id   INTEGER NOT NULL,
  action      TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX audit_created_idx ON audit_log (created_at DESC);

-- Programme settings managed by the platform admin.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
