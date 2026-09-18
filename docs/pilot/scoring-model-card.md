# Scoring model card for the Bogotá pilot

This model ranks CIIU divisions for subsequent research. The current `sector-opportunity-co-v1` implementation is a deterministic prototype trained on no data and exercised only with synthetic values; its factors, weights, and 65% coverage threshold are hypotheses, not validated business truth.

## Intended use

| Allowed | Not allowed |
|---|---|
| Compare approved Bogotá CIIU divisions within the same release and reference basis. | Predict purchases, revenue, conversion, or future returns. |
| Explain why one division should be researched before another. | Rank companies, establishments, people, CIIU classes, or Bogotá localities. |
| Surface uncertainty, missingness, and source quality separately. | Treat confidence as opportunity or `insufficient_data` as low opportunity. |
| Support—not replace—internal research judgment. | Automate outreach or make consequential decisions about an organization or person. |

Cross-version scores are not comparable unless a documented backtest proves comparability.

## Target construct

The approved pilot model must operationalize five factor families: market size, digital gap, automation potential, dynamism, and economic capacity. Each factor needs an admitted official source or a clearly typed deterministic derivation from official data.

The current prototype has seven factors and no explicit dynamism factor:

| Prototype factor | Weight | Pilot disposition |
|---|---:|---|
| `digital_gap` | 20 | Maps to the target family; definition and source pending. |
| `automation_potential` | 20 | Maps to the target family; evidence method and type pending. |
| `economic_capacity` | 15 | Maps to the target family; definition and source pending. |
| `accessible_market` | 15 | Candidate proxy for market size; mapping requires validation. |
| `competitive_pressure` | 10 | Additional hypothesis; retain or remove through a new model version. |
| `service_fit` | 10 | Additional hypothesis; likely expert-derived and must be labelled accordingly. |
| `accessibility` | 10 | Additional hypothesis; must remain aggregate and cannot infer leads. |
| Dynamism | — | Missing from the prototype; required before target-model approval. |

No agent or implementer may invent the missing production definitions, sources, or weights. The three-expert protocol evaluates a documented candidate, and the product owner approves the final version.

## Current calculation

For a model with factor weights `wᵢ` and normalized values `xᵢ ∈ [0,1] | null`:

```text
available_weight = Σ wᵢ where xᵢ is not null
coverage         = available_weight / Σ wᵢ × 100
score            = Σ(xᵢ × wᵢ) / available_weight × 100
```

The prototype emits a score only at coverage `>= 65%`. Available weights are renormalized; missing values remain `null`. Below the threshold, status is `insufficient_data`, score is `null`, and every contribution is `null`.

This behavior is implemented and unit-tested. The weights and threshold still require expert and product approval for the Bogotá CIIU pilot.

## Opportunity and confidence

Opportunity answers **“what should we research first?”** Confidence answers **“how trustworthy and comparable is the supporting evidence?”** They are separate models, versions, factors, and outputs.

The prototype confidence model uses authority/traceability (30), completeness (25), freshness (20), cross-source consistency (15), and entity resolution (10), with 100% factor coverage. Display labels are high at 80+, medium at 60+, low at 40+, otherwise insufficient.

Before production, each confidence factor needs a deterministic definition. In particular:

- freshness must use the admitted source cadence and reference period;
- consistency must define the comparison sources and disagreement rule;
- entity resolution must mean CIIU/geography mapping quality, not identification of companies;
- mixed periods require a documented penalty;
- confidence must not rescue an opportunity result below opportunity coverage.

## Publication lifecycle

Numerical coverage alone does not make a pilot result publishable. A coverage-passing calculation begins as `pending_validation`. It becomes `scored` only after the expert gate and product-owner approval for the exact model/dataset combination. A failed candidate becomes `rejected`; its lineage is retained.

> **Current implementation gap:** the current scorer returns `scored` immediately when coverage passes. The target publication lifecycle requires future contract and persistence changes.

## Sensitivity and validation requirements

Before approval, the candidate model report must include:

- one-factor-at-a-time variation across each factor's valid range;
- leave-one-factor-out rankings where coverage still passes;
- rankings at plausible alternative weights and coverage thresholds;
- rank changes caused by missing inputs and renormalization;
- period-mismatch and stale-source scenarios;
- comparison of division ordering with each expert's rationale;
- any divisions whose ranking is dominated by one factor or one source.

Sensitivity analysis diagnoses fragility; it does not optimize weights to agree with reviewers. Any weight or threshold change creates a new model version and repeats validation.

## Limitations and bias

- Official data can lag current conditions and may measure formal activity better than informal activity.
- Aggregate division values can hide heterogeneity among organizations.
- Source availability can favor well-measured divisions.
- CIIU concordances and multi-activity organizations can create classification ambiguity.
- Renormalization changes factor influence when data is missing.
- Expert judgments can encode commercial assumptions and must remain visible as `expert` evidence.
- The synthetic fixture proves software behavior only; it provides no evidence of business validity.

## Versioning and reproducibility

A model version is immutable after publication and must bind:

- model ID/version and status;
- factor keys, definitions, weights, transformations, directionality, and coverage rule;
- confidence model version;
- CIIU version and inclusion/exclusion policy version;
- code revision and deterministic runtime configuration;
- dataset versions and original-file SHA-256 checksums;
- sensitivity report, expert-validation record, and product-owner decision.

Any semantic change—including a factor definition, source mapping, transformation, weight, threshold, missing-data rule, or confidence penalty—requires a new version. Reprocessing corrected official bytes also creates a new dataset version; published records are not overwritten.

## Approval checklist

- [ ] All five intended factor families have approved definitions and evidence.
- [ ] Additional prototype factors are explicitly retained or removed.
- [ ] Weights and coverage threshold are documented as approved, not hypotheses.
- [ ] Opportunity and confidence definitions are reproducible.
- [ ] Sensitivity and bias review is complete.
- [ ] Three-expert acceptance criteria pass.
- [ ] Product owner approves the exact release binding.

