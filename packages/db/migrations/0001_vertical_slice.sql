CREATE TYPE license_review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE import_status AS ENUM ('running', 'completed', 'failed', 'duplicate');
CREATE TYPE score_status AS ENUM ('scored', 'insufficient_data');
CREATE TYPE app_role AS ENUM ('administrator', 'analyst', 'commercial_partner', 'technical_partner');

CREATE TABLE data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, organization text NOT NULL,
  official_url text, country_code text NOT NULL, license_name text,
  license_review_status license_review_status NOT NULL DEFAULT 'pending', outreach_allowed boolean NOT NULL DEFAULT false,
  cadence text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES data_sources(id), period text NOT NULL,
  checksum_sha256 text NOT NULL, downloaded_at timestamptz NOT NULL, schema_version text NOT NULL, raw_uri text NOT NULL,
  byte_size integer NOT NULL, is_synthetic boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, checksum_sha256)
);
CREATE TABLE import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id),
  status import_status NOT NULL, code_version text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  rows_read integer NOT NULL DEFAULT 0, rows_accepted integer NOT NULL DEFAULT 0, rows_rejected integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE geographies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_code text NOT NULL, city text NOT NULL, official_code text NOT NULL,
  UNIQUE(country_code, official_code)
);
CREATE TABLE score_model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, version text NOT NULL, weights jsonb NOT NULL,
  minimum_coverage double precision NOT NULL, active boolean NOT NULL DEFAULT false, activated_at timestamptz,
  UNIQUE(kind, version)
);
CREATE TABLE sector_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), geography_id uuid NOT NULL REFERENCES geographies(id),
  sector_code text NOT NULL, sector_name text NOT NULL, period text NOT NULL,
  model_version_id uuid NOT NULL REFERENCES score_model_versions(id), dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id),
  status score_status NOT NULL, opportunity_score double precision, confidence_score double precision NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sector_scores_market_idx ON sector_scores(geography_id, period);
CREATE TABLE sector_score_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sector_score_id uuid NOT NULL REFERENCES sector_scores(id),
  factor_key text NOT NULL, raw_value double precision, normalized_value double precision, weight double precision NOT NULL,
  contribution double precision, transformation text NOT NULL, evidence_uri text NOT NULL, observed_at timestamptz NOT NULL
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id text NOT NULL UNIQUE, role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id), action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
