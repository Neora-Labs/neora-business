# Bogotá pilot specification

This document set defines the evidence and approval gates for an internal pilot that ranks **Bogotá × CIIU division × reference period** for later commercial research. It is the product target, not a claim that the current synthetic, three-city demo already satisfies it.

## Read in this order

1. [Product requirements](product-requirements.md) — purpose, users, scope, result states, and acceptance criteria.
2. [Data dictionary and source catalog](data-dictionary-and-source-catalog.md) — required fields, evidence classes, source admission, and lineage.
3. [Scoring model card](scoring-model-card.md) — interpretation, current hypothesis, coverage, confidence, and versioning.
4. [Expert validation protocol](expert-validation.md) — three-reviewer rubric and approval record.
5. [Governance and operations](governance-and-operations.md) — ownership, publication gates, and runbooks.

## Status legend

| Label | Meaning |
|---|---|
| **Current** | Verified in the repository today. |
| **Pilot requirement** | Required before the Bogotá pilot can be accepted or published. |
| **Pending decision** | An owner must provide or approve the value; it must not be invented. |

## Current gap summary

The current vertical slice ranks five synthetic sector aliases in Bogotá, Medellín, and Cali. It proves deterministic scoring, immutable raw storage, checksum lineage, and separate opportunity/confidence calculations. It does **not** yet provide the full Colombian CIIU division universe, official production sources, evidence-type classification, expert-validation records, or all five pilot result states.

Those gaps are future interface requirements. They require contract, schema, pipeline, persistence, and UI changes outside this documentation-only work.

