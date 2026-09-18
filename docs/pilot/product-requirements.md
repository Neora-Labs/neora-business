# Product requirements for the Bogotá opportunity pilot

The pilot helps an internal team decide which Bogotá economic divisions deserve deeper commercial research. It produces a relative, evidence-backed priority—not a lead, sales forecast, or probability of purchase.

## Product decision

| Topic | Decision |
|---|---|
| Primary user | Internal research and product team. |
| Decision supported | Select CIIU divisions for subsequent commercial research. |
| Unit of analysis | `Bogotá × CIIU division × reference period`. |
| Evidence boundary | Official, open sources only for production evidence. |
| Validation | Independent panel of three experts followed by product-owner approval. |
| Initial success | Useful and explainable prioritization, not revenue or conversion. |

### Operational definition of opportunity

Opportunity is the relative priority of a CIIU division for further commercial research. The intended model combines market size, digital gap, automation potential, dynamism, and sector economic capacity.

The result does **not** represent probability of purchase, expected revenue, commercial intent, company quality, or future performance. A higher result means “investigate this division earlier,” not “contact every organization in it.”

## User workflow

1. An operator admits official source versions and imports immutable raw files.
2. The pipeline maps evidence to Bogotá, an official CIIU division, and a reference period.
3. The versioned model calculates opportunity and confidence separately.
4. The system assigns a result state and retains complete lineage.
5. Three experts review the candidate release using the [validation protocol](expert-validation.md).
6. The product owner approves or rejects that exact model-and-dataset release.
7. Internal users compare only approved, traceable results and choose divisions for further research.

## Analysis boundary

### In scope

- Bogotá as one geography.
- Divisions from the verified current official Colombian CIIU classification.
- One explicit reference period per result.
- Aggregate, non-personal evidence from official open sources.
- Relative ranking, factor explanations, confidence, and evidence lineage.

### Out of scope

- Companies, establishments, people, leads, or CIIU classes.
- Bogotá localities or any city outside Bogotá.
- Campaigns, outreach, lead queues, exports, or sales workflows.
- Purchase probability, expected revenue, conversion, or future-performance prediction.
- Re-identification or inference of companies from anonymized microdata.

## Division universe and eligibility

Each release must materialize a versioned division universe from the selected official CIIU edition. The exact edition and official reference remain **pending** until recorded and approved in the [source catalog](data-dictionary-and-source-catalog.md); they must not be inferred from the synthetic fixture.

Every division in that universe must receive exactly one result state. Inclusion is the default. A division may be `excluded` only through a versioned rule approved by the product owner and accompanied by a reason. Lack of evidence is never an exclusion reason; it yields `insufficient_data`.

The release-specific inclusion register must record:

- CIIU version, division code, and official division name;
- `included` or `excluded` decision;
- exclusion rule and rationale, when applicable;
- approver and decision timestamp.

No production release may omit a division silently.

## Result states

Each analysis unit has exactly one state:

| State | Meaning | Score visibility |
|---|---|---|
| `scored` | Coverage passed, expert gate passed, and the product owner approved the exact release. | Opportunity and confidence may be published internally. |
| `insufficient_data` | Required weighted coverage was not met. | Opportunity score is `null`; confidence and missingness may be shown. This is not low opportunity. |
| `excluded` | A documented, versioned exclusion rule applies. | No opportunity score. Show the exclusion reason. |
| `pending_validation` | Calculation completed but the expert panel or product-owner decision is incomplete. | Candidate values remain non-published review material. |
| `rejected` | The panel or product owner rejected the candidate release for publication. | Do not publish the opportunity score; retain review reasons and lineage. |

The intended transition is `pending_validation → scored | rejected`. `insufficient_data` and `excluded` are terminal for that release, but a new dataset or policy version may produce a new result. Published records are never edited in place.

> **Current implementation gap:** contracts and persistence currently support only `scored` and `insufficient_data`, and `scored` currently means numerical coverage passed. The additional states and approval semantics are future interface requirements.

## Product rules

- Missing evidence remains `null`. It may be zero only when the official source explicitly defines the observed value as zero.
- `insufficient_data` must never be sorted or described as low opportunity.
- Periods may not be mixed silently. Any approved mixed-period model must disclose the periods and apply a documented confidence penalty.
- Expert evidence must be labelled `expert`; it cannot be presented as an observed statistic.
- Results must expose opportunity and confidence as separate concepts and values.
- A published model or dataset version is immutable; change creates a new version.
- Only official open evidence may enter a production result. The checked-in synthetic fixture is test evidence only.

## Acceptance criteria

A Bogotá pilot release is accepted only when all are true:

- every division in the release universe is represented as `scored`, `insufficient_data`, `excluded`, `pending_validation`, or `rejected`;
- every published factor traces to an approved official source, its license record, original checksum, and deterministic transformation;
- identical raw inputs, configuration, code version, dataset version, and model version produce identical results;
- divisions below minimum coverage have `score = null` and state `insufficient_data`;
- reviewers can explain relative ordering from factor contributions and source evidence;
- the three-expert panel reaches the required rubric threshold with no critical provenance objection;
- the product owner approves the exact CIIU, dataset, model, and validation versions.

Current automated tests prove parts of determinism and missing-data behavior against synthetic data. They do not satisfy the official-source, complete-universe, or expert-validation acceptance gates.

