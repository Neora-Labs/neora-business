ALTER TABLE data_sources ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;
ALTER TABLE sector_scores ADD COLUMN confidence_model_version_id uuid REFERENCES score_model_versions(id);
ALTER TABLE sector_scores ADD COLUMN score_payload jsonb;
ALTER TABLE sector_scores ALTER COLUMN confidence_score DROP NOT NULL;

CREATE TABLE sector_metrics (
  id uuid PRIMARY KEY, dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id),
  geography_id uuid NOT NULL REFERENCES geographies(id), sector_code text NOT NULL,
  sector_name text NOT NULL, period text NOT NULL, values jsonb NOT NULL
);
CREATE TABLE confidence_score_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sector_score_id uuid NOT NULL REFERENCES sector_scores(id),
  factor_key text NOT NULL, normalized_value double precision, weight double precision NOT NULL,
  contribution double precision, evidence_uri text NOT NULL, observed_at timestamptz NOT NULL
);
CREATE TABLE evidence_records (
  id text PRIMARY KEY, sector_score_id uuid NOT NULL REFERENCES sector_scores(id), title text NOT NULL,
  source_name text NOT NULL, source_uri text NOT NULL, observed_at timestamptz NOT NULL,
  license_review_status license_review_status NOT NULL
);

UPDATE sector_scores SET confidence_model_version_id = model_version_id, score_payload = '{}'::jsonb
WHERE confidence_model_version_id IS NULL OR score_payload IS NULL;
ALTER TABLE sector_scores ALTER COLUMN confidence_model_version_id SET NOT NULL;
ALTER TABLE sector_scores ALTER COLUMN score_payload SET NOT NULL;
