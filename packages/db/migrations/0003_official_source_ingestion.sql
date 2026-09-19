CREATE TYPE official_import_status AS ENUM ('pending_review','approved','processing','completed','failed','blocked_mapping','rejected');
CREATE TYPE evidence_type AS ENUM ('observed','derived','expert','group_12');
CREATE TYPE mapping_status AS ENUM ('verified','unresolved','rejected');

CREATE TABLE source_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text NOT NULL UNIQUE, name text NOT NULL,
  organization text NOT NULL, official_url text NOT NULL, license_name text, ciiu_version text NOT NULL,
  latest_observation_year integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_variable_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_catalog_id uuid NOT NULL REFERENCES source_catalog(id),
  variable_key text NOT NULL, label text NOT NULL, dictionary_url text NOT NULL, dataset_version text NOT NULL,
  UNIQUE (source_catalog_id, dataset_version, variable_key)
);
CREATE TABLE official_import_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_catalog_id uuid NOT NULL REFERENCES source_catalog(id),
  proposed_by uuid NOT NULL REFERENCES users(id), reviewed_by uuid REFERENCES users(id), status official_import_status NOT NULL,
  ciiu_version text NOT NULL CHECK (ciiu_version = 'ciiu_4ac_2022'), period text NOT NULL, dataset_version text NOT NULL,
  file_name text NOT NULL, checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'), raw_key text NOT NULL, byte_size integer NOT NULL CHECK (byte_size >= 0),
  evidence_type evidence_type NOT NULL, review_reason text, claimed_by text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
  UNIQUE (source_catalog_id, checksum_sha256), CHECK (reviewed_by IS NULL OR reviewed_by <> proposed_by)
);
CREATE TABLE ica_ciiu_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_request_id uuid NOT NULL REFERENCES official_import_requests(id),
  source_code text NOT NULL, source_description text NOT NULL, target_ciiu_class text, target_ciiu_division text,
  mapping_method text, evidence_url text, mapping_status mapping_status NOT NULL, reviewed_at timestamptz,
  UNIQUE (import_request_id, source_code),
  CHECK ((mapping_status = 'verified' AND target_ciiu_division IS NOT NULL AND evidence_url IS NOT NULL) OR mapping_status <> 'verified')
);

INSERT INTO source_catalog (source_key,name,organization,official_url,license_name,ciiu_version,latest_observation_year) VALUES
('emicron-2025','EMICRON 2025','DANE / DIMPE','https://microdatos.dane.gov.co/index.php/catalog/914/data-dictionary',NULL,'ciiu_4ac_2022',NULL),
('ica-2007-2023','Recaudo ICA Sector CIIU 2007–2023. Bogotá D.C.','Secretaría Distrital de Hacienda','https://datosabiertos.bogota.gov.co/dataset/62be0dca-281d-4dee-b27e-c65153e9c9bf/resource/b59cbca5-21d1-4854-98ed-be6bfd2b3a32/download/19.-recaudo_ica_sector_ciiu_2007_2023.csv','CC BY 4.0','ciiu_4ac_2022',2023)
ON CONFLICT (source_key) DO NOTHING;


ALTER TYPE score_status ADD VALUE IF NOT EXISTS 'excluded';
ALTER TYPE score_status ADD VALUE IF NOT EXISTS 'pending_validation';
ALTER TYPE score_status ADD VALUE IF NOT EXISTS 'rejected';
