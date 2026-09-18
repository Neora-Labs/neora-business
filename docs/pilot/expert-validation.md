# Expert validation protocol

Three experts independently assess whether a candidate Bogotá release is relevant, explainable, and supported by trustworthy evidence. The panel recommends; the product owner makes the final release decision.

## Validation package

The coordinator freezes one review package containing:

- CIIU version and complete division universe;
- inclusion/exclusion policy and register;
- dataset versions, periods, checksums, and source-catalog records;
- opportunity and confidence model versions;
- factor definitions, transformations, weights, coverage, and missingness;
- candidate result state and factor explanation for every division;
- sensitivity report and known limitations.

Reviewers must evaluate the same immutable package. A changed input, model, mapping, or result invalidates the review and requires a new validation record.

## Panel composition and independence

- Exactly three named reviewers participate.
- The validation record states each reviewer's relevant expertise and conflicts of interest.
- Reviewers score independently before seeing aggregate scores.
- A reviewer cannot alter data, model weights, or another reviewer's response during the review.
- Product ownership is separate from panel recommendation; if one person holds both roles, the dual role must be disclosed.

Specific people remain a governance assignment and must not be invented in documentation.

## Rubric

Each reviewer scores every dimension from 1 to 5 for the candidate release and may attach division-specific notes.

| Score | Relevance | Explainability | Confidence |
|---:|---|---|---|
| 1 | Does not support the research-priority decision. | Ordering cannot be reconstructed or justified. | Evidence is materially unreliable or unverifiable. |
| 2 | Weak relationship to the decision. | Major reasoning or contribution gaps. | Major quality, mapping, freshness, or consistency concerns. |
| 3 | Partially useful with material caveats. | Main drivers are visible but important ambiguity remains. | Evidence is usable only with material caveats. |
| 4 | Clearly supports the intended decision. | Ordering and factor effects are understandable and traceable. | Evidence is trustworthy for internal prioritization with minor caveats. |
| 5 | Strongly aligned with the intended decision. | Ordering is fully reproducible and readily explained. | Evidence is highly trustworthy, current enough, and consistently mapped. |

Reviewers also answer:

- Can you explain why each of the highest-priority divisions ranks above the next alternatives?
- Is any result misleading because of missingness, renormalization, period mismatch, or classification mapping?
- Does any evidence claim lack a verified official source, open-use basis, immutable original, or reproducible transformation?
- Are expert judgments clearly distinguished from observed and derived evidence?

## Critical provenance objection

A reviewer must flag a critical provenance objection when publication would rely on any of these unresolved conditions:

- non-official or unverified source presented as production evidence;
- absent or unapproved license/terms record;
- missing original-file checksum or immutable raw asset;
- non-reproducible or undisclosed transformation;
- ambiguous CIIU or Bogotá mapping;
- silent period mixing or stale evidence without the approved treatment;
- expert judgment presented as an observed statistic.

The objection must identify the affected source, indicator, division(s), and evidence. It cannot be cleared by averaging rubric scores; the source/model/data defect must be corrected in a new candidate package or the affected results must not be published.

## Decision rule

The panel recommends acceptance only when:

1. all three reviews are complete;
2. median relevance is at least `4`;
3. median explainability is at least `4`; and
4. there are no unresolved critical provenance objections.

Confidence is always scored and reported, but it is diagnostic rather than a separate numerical acceptance threshold for the initial pilot. The product owner may reject a passing recommendation with a documented reason; the product owner may **not** override an unresolved critical provenance objection or the required relevance/explainability medians.

Candidate outcomes:

- panel passes + product owner approves → `scored`;
- panel fails or product owner declines → `rejected`;
- any review or owner decision incomplete → `pending_validation`.

## Disagreement handling

1. Preserve all individual scores and comments.
2. Calculate medians without changing individual responses.
3. Record division-specific disagreements and whether they concern product interpretation, model behavior, or provenance.
4. The coordinator may request clarification, not score negotiation.
5. A data/model correction produces a new immutable candidate and a new review round.
6. Non-blocking dissent remains in the approved validation record.

## Versioned validation record — future interface

The current repository has no expert-validation entity. A future record must bind the decision to exact versions and preserve individual reviews.

```yaml
validation_id: immutable-id
validation_version: version
candidate:
  ciiu_version: version
  inclusion_policy_version: version
  dataset_version_ids: [id]
  opportunity_model_version: version
  confidence_model_version: version
  result_set_checksum_sha256: 64-lowercase-hex
reviewers:
  - reviewer_id: internal-id
    expertise: disclosed-area
    conflict_disclosure: text
    submitted_at: ISO-8601
    scores:
      relevance: 1..5
      explainability: 1..5
      confidence: 1..5
    critical_provenance_objections: []
    division_comments: []
panel_summary:
  median_relevance: number
  median_explainability: number
  median_confidence: number
  recommendation: accept | reject
  disagreements: []
product_owner_decision:
  owner_id: internal-id
  decision: approved | rejected | pending
  reason: text
  decided_at: ISO-8601-or-null
```

The record is append-only. Corrections create a new validation version; they do not rewrite submitted reviews.

