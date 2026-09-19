# Data dictionary and source catalog

This document defines the minimum data and provenance required for the Bogotá pilot. A field marked **future** is not fully represented by the current contracts or database and must not be described as implemented.

## Analysis-unit fields

| Field | Type / format | Required rule | Implementation status |
|---|---|---|---|
| `geography_code` | official code, string | Must identify Bogotá under the selected official geography reference. | Current `geographies.official_code` can store it; the verified code/reference is pending. |
| `geography_name` | string | Canonical display value `Bogotá`. | Current `city`/`geographies.city`. |
| `ciiu_version` | string | Exact approved Colombian CIIU edition. | **Future**; not in score contract or persistence. |
| `division_code` | official division code, string | Preserve leading zeroes and validate against `ciiu_version`. | Current `sectorCode` is a free-form synthetic alias; **future validation required**. |
| `division_name` | string | Official name for the code and version; never hand-authored alias. | Current `sector`/`sectorName` exists but is not official CIIU. |
| `reference_period` | string or bounded interval | One disclosed period for the result; format must be defined by the admitted source. | Current `period` string. |
| `result_state` | enum | One of the five states in the PRD. | Current system has two states; **future expansion required**. |
| `opportunity_score` | number `0..100` or `null` | Non-null only for publishable `scored`; never infer zero for absence. | Current `score`/`opportunity_score`, with narrower lifecycle semantics. |
| `confidence_score` | number `0..100` or `null` | Separate from opportunity; null when its own coverage fails. | Current calculation exists; contract currently requires a number. |
| `coverage_percent` | number `0..100` | Weighted availability used for the opportunity gate. | Calculated by scoring but not exposed in the current wire contract. |

The natural business key is `(geography_code, ciiu_version, division_code, reference_period, dataset_version, model_version)`. Implementations may use surrogate IDs but must preserve this identity.

## Evidence types

Every input indicator and review assertion must carry exactly one type:

| Type | Meaning | Allowed use |
|---|---|---|
| `observed` | Published directly by an official source. | Store the source value, unit, period, and location without changing its meaning. |
| `derived` | Deterministically calculated only from official source data. | Store the formula/transformation version and all upstream evidence. |
| `expert` | A judgment produced through the expert protocol. | Validation and qualitative review only unless a future model explicitly versions it as an expert input. Never label it statistical observation. |

> **Current implementation gap:** factor and evidence records do not carry this classification. `evidence_type` is a future contract and persistence field.

## Indicator dictionary

All numeric scoring inputs use a normalized `0..1` value only after an approved transformation. Raw values and units must also be retained. Periodicity, exact source variables, and transformations remain pending until official sources are admitted.

| Intended factor family | Current prototype key | Required definition before production | Unit and missing rule |
|---|---|---|---|
| Market size | `accessible_market` is the current proxy | Define the official measure of addressable division scale and its Bogotá/CIIU mapping. | Raw source unit plus normalized `0..1`; missing is `null`. |
| Digital gap | `digital_gap` | Define the observable digital-adoption deficit and directionality. | Raw source unit plus normalized `0..1`; higher must consistently mean greater priority. |
| Automation potential | `automation_potential` | Define the reproducible derivation or approved expert method. | Normalized `0..1`; expert inputs must be typed `expert`. |
| Dynamism | none | Select an official growth/change measure, comparison window, and transformation. | **Future required factor**; never synthesize it from another factor. |
| Economic capacity | `economic_capacity` | Define the official capacity measure and treatment of scale effects. | Raw source unit plus normalized `0..1`; missing is `null`. |
| Competitive pressure | `competitive_pressure` | Decide whether it remains in the pilot and define score direction. | Current hypothesis only. |
| Service fit | `service_fit` | Decide whether it remains and whether evidence can be non-expert. | Current hypothesis only; classification must be explicit. |
| Accessibility | `accessibility` | Decide whether it remains without becoming company/lead inference. | Current hypothesis only; aggregate division evidence only. |

Each admitted indicator definition must add: stable key, human label, business meaning, source column(s), raw unit, expected periodicity, geography level, CIIU level, aggregation formula, normalization formula, directionality, valid range, null rule, period-alignment rule, owner, and transformation version.

## Required lineage metadata

Each result must retain or resolve to:

- CIIU version;
- opportunity-model and confidence-model versions;
- dataset version and schema version;
- reference period;
- source and indicator identifiers;
- evidence type for each indicator;
- raw value, unit, normalized value, weight, and contribution;
- transformation name/version and parameters;
- achieved coverage and missing factor keys;
- original file SHA-256 checksum, immutable raw URI, byte size, and download timestamp;
- official publisher, official URL, license name/URL, and license-review decision;
- expert-validation record and product-owner approval for the exact release.

The current system already stores parts of this chain: dataset checksum, download time, schema version, raw URI, model versions, factor values/contributions, evidence URI, observation time, and license-review status. CIIU version, evidence type, raw unit, explicit coverage, transformation version, and expert validation are future requirements.

## Source admission policy

A production source is admissible only when it is:

1. published or formally maintained by an official public body;
2. accessible under documented open terms that permit the intended internal analysis;
3. aggregate at a level compatible with Bogotá and CIIU division analysis without re-identification;
4. reproducibly downloadable or archived as immutable original bytes;
5. accompanied by a deterministic mapping and quality assessment.

An official publisher does not automatically imply an open license. Both authority and license must be verified. Pending, unclear, rejected, or inaccessible sources cannot support a published pilot score.

### Source catalog

No production source has been verified in this documentation pass. Do not replace the pending rows with guesses.

| Catalog ID | Purpose | Publisher / official URL | License | Coverage / cadence | Status |
|---|---|---|---|---|---|
| `ciiu-classification-pending` | Division universe and official names | Pending verification | Pending verification | National classification; edition pending | Not admitted |
| `market-size-pending` | Market-size indicator | Pending verification | Pending verification | Bogotá × division × period required | Not admitted |
| `digital-gap-pending` | Digital-gap indicator | Pending verification | Pending verification | Bogotá × division × period required | Not admitted |
| `automation-potential-pending` | Automation-potential evidence | Pending verification | Pending verification | Method and evidence type pending | Not admitted |
| `dynamism-pending` | Dynamism indicator | Pending verification | Pending verification | Comparison window pending | Not admitted |
| `economic-capacity-pending` | Economic-capacity indicator | Pending verification | Pending verification | Bogotá × division × period required | Not admitted |

The checked-in `colombia_sector_metrics.synthetic.csv` is documented separately as a test fixture. It is not part of this production catalog and cannot pass source admission.

### Catalog record template

```yaml
catalog_id: stable-internal-id
title: exact-official-dataset-title
publisher: exact-official-organization
official_url: https://...
license_name: exact-license-or-terms-name
license_url: https://...
license_review_status: pending | approved | rejected
license_reviewer: internal-role-or-id
license_reviewed_at: ISO-8601-or-null
permitted_purpose: internal-market-prioritization
coverage:
  geography: exact-level-and-codes
  ciiu_version: exact-edition
  ciiu_level: division
  period: exact-period-or-range
cadence: source-published-cadence
freshness_window: owner-approved-duration
downloaded_at: ISO-8601
checksum_sha256: 64-lowercase-hex
raw_uri: immutable-private-uri
byte_size: integer
schema_version: version
owner: accountable-data-role
status: proposed | admitted | suspended | retired
```

## Missing, incompatible, and stale evidence

- **Missing:** retain `null`; never coerce to zero. Coverage decides whether scoring is allowed.
- **CIIU mismatch:** do not join silently. Store and version an explicit concordance; ambiguous mappings fail admission for affected divisions.
- **Geography mismatch:** broader or different geographies cannot be relabelled as Bogotá. A documented derivation must justify any allocation.
- **Period mismatch:** do not mix silently. If the product owner approves mixed periods, retain every period and apply a versioned confidence penalty.
- **Stale:** compare the source period/download date with its approved freshness window. Missing freshness policy or expired evidence blocks publication, not ingestion for research.
- **Revisions:** new official bytes create a new dataset version even when the publisher reuses a URL or filename.


## Admitted Bogotá pilot sources

The following sources are registered by the official ingestion migration and are the only sources accepted by the administrative upload flow:

| Catalog ID | Official publisher | CIIU / coverage | License / freshness | Ingestion rule |
|---|---|---|---|---|
| `emicron-2025` | DANE / DIMPE — [data dictionary](https://microdatos.dane.gov.co/index.php/catalog/914/data-dictionary) | EMICRON 2025, Bogotá filter `COD_DEPTO="11" AND AREA="11"`; CIIU Rev. 4 derived `GRUPOS12` | Official dictionary is mandatory for every used `Pxxxx` label. | `F_EXP` weighted aggregate only; stored as `group_12` contextual evidence, never division evidence. |
| `ica-2007-2023` | Secretaría Distrital de Hacienda — [download](https://datosabiertos.bogota.gov.co/dataset/62be0dca-281d-4dee-b27e-c65153e9c9bf/resource/b59cbca5-21d1-4854-98ed-be6bfd2b3a32/download/19.-recaudo_ica_sector_ciiu_2007_2023.csv) | Bogotá CIIU SHD declarations and recaudo, 2007–2023 | CC BY 4.0; `latest_observation_year=2023`. | cp1252/semicolon parsing. No CIIU division metric until a versioned, evidence-backed SHD crosswalk is verified. |

The published pilot identifier is exclusively `ciiu_4ac_2022` at two-digit **division** level. CIIU Rev. 5 A.C. is not accepted. An unresolved SHD mapping produces `insufficient_data`, never a truncated or guessed division.
