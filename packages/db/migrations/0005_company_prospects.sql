CREATE TYPE prospect_priority AS ENUM ('A', 'B', 'C');

CREATE TABLE prospect_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  checksum_sha256 text NOT NULL UNIQUE,
  imported_by uuid NOT NULL REFERENCES users(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  rows_read integer NOT NULL,
  rows_accepted integer NOT NULL,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE company_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_import_id uuid NOT NULL REFERENCES prospect_imports(id),
  external_id text NOT NULL,
  company_name text NOT NULL,
  sector text NOT NULL,
  geography text NOT NULL,
  public_url text NOT NULL,
  fit_signal text NOT NULL,
  initial_proposal text NOT NULL,
  priority prospect_priority NOT NULL,
  outreach_status text NOT NULL,
  decision_maker_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_prospects_bogota_only CHECK (geography = 'Bogotá'),
  CONSTRAINT company_prospect_external_per_import_unique UNIQUE (prospect_import_id, external_id)
);
CREATE INDEX company_prospects_sector_status_idx ON company_prospects (sector, outreach_status);
