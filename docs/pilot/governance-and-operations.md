# Governance and operations for the Bogotá pilot

This operating policy keeps source admission, model approval, publication, and incident response auditable. Role names define accountability; specific assignees are pending and must be recorded before a production pilot release.

## Accountability

| Role | Accountable for | May not do alone |
|---|---|---|
| Product owner | Scope, division eligibility policy, model release, final publication decision | Override provenance blockers or rewrite published versions. |
| Data owner | Source catalog, license review coordination, mappings, freshness, data quality | Approve model meaning solely by admitting a source. |
| Model owner | Factor definitions, weights, thresholds, sensitivity, model versions | Present hypotheses as validated or approve their own release alone. |
| Pipeline operator | Acquisition, checksum verification, deterministic import, operational logs | Change source/model semantics during a run. |
| Validation coordinator | Freeze review package, collect three independent reviews, calculate medians | Alter reviewer scores or clear provenance objections. |
| Access administrator | Invite/revoke users and maintain database role mappings | Grant access without an auditable request. |
| Incident lead | Coordinate containment, assessment, recovery, and post-incident review | Delete lineage needed for investigation. |

Production readiness requires a named assignee and backup for each role.

## Publication gates

A release can be internally published only when:

- the official CIIU edition and complete Bogotá division universe are approved;
- every source is admitted, official, open for the intended use, and within its freshness policy;
- all original assets are immutable and match recorded SHA-256 checksums;
- transformations and scoring are deterministic and versioned;
- every division has exactly one valid result state;
- the expert panel passes the rubric with no critical provenance objection;
- the product owner approves the exact release binding;
- access, audit, rollback, and incident owners are assigned.

The current synthetic demo cannot pass these gates and remains research/test-only.

## Approving a new source

1. **Propose:** create a pending catalog record; do not use the source in published scores.
2. **Verify authority:** confirm publisher identity and canonical official URL.
3. **Review terms:** record exact license/terms, permitted purpose, and internal reviewer.
4. **Assess data:** document geography, CIIU level/version, period, cadence, schema, and personal-data risk.
5. **Reproduce:** download original bytes, calculate SHA-256, store immutably, and execute the documented mapping and quality checks.
6. **Approve:** data owner marks the exact catalog version admitted; unresolved fields keep it pending.
7. **Monitor:** suspend future publication on license change, source drift, checksum dispute, staleness, or material quality failure.

Rejected or suspended sources and their prior decisions remain in the audit history.

## Refresh and evidence expiry

- Source cadence and freshness window are catalog fields, not global guesses.
- The data owner sets a freshness window from the publisher's release behavior and the product decision's tolerance.
- A scheduled or manual pre-publication check compares the reference period and download time with that window.
- An overdue source blocks new publication and triggers source review. Existing results remain historically traceable but are labelled superseded/stale according to the release policy.
- A publisher revision creates a new dataset version even if its URL and nominal period are unchanged.

Exact refresh schedules remain pending until real sources are admitted.

## Runbooks

### Import an approved dataset

1. Confirm the catalog version is admitted and the expected schema/mapping versions are active.
2. Acquire bytes from the recorded official URL; never edit the original.
3. Calculate SHA-256 and store under an immutable checksum-addressed URI.
4. Validate schema, geography, CIIU mapping, period, ranges, nulls, duplicates, and row counts.
5. Normalize deterministically and retain raw values, units, and transformation versions.
6. Import through the repository transaction and record code version, counts, timestamps, and errors.
7. Reconcile the complete division universe and assign pre-validation result states.
8. Re-run the same inputs to confirm identical output before freezing the validation package.

Current commands cover the synthetic connector only; a production connector and source-specific checks are future implementation work.

### Roll back a release

1. Stop publication of the affected release and record actor, reason, and timestamp.
2. Re-point the active release to the last approved model-and-dataset binding; do not mutate or delete either release.
3. Verify every visible result and evidence link resolves to the restored binding.
4. Record the rollback in audit history and notify internal users of impact.
5. Correct inputs or logic in new versions, then repeat validation and approval.

Database/schema rollback procedures and production deployment automation are not yet implemented in this repository.

### Grant or revoke access

1. Obtain an auditable request with requester, user identity, required role, scope, and expiry/review date.
2. The access administrator changes the Clerk-to-database role mapping using the controlled provisioning procedure.
3. Verify least-privilege access and denial of non-permitted operations.
4. Record approval, actor, timestamp, and result.
5. Revoke promptly on role change, expiry, or separation; retain the audit record.

Current role seeding is manual SQL and there is no provisioning UI. Production operations require a controlled wrapper/process and periodic access review.

### Audit a release

1. Select the immutable release identifier.
2. Resolve CIIU, inclusion policy, datasets, sources, checksums, model versions, code revision, transformations, validation, and owner decision.
3. Recalculate a sample or the full release from immutable inputs.
4. Compare result-set checksum and division-state completeness.
5. Record discrepancies as incidents; never patch published records in place.

### Handle a data or model incident

1. **Detect and classify:** record affected release(s), source(s), divisions, users, and severity.
2. **Contain:** suspend the release/source and prevent new publication; preserve raw files, logs, and audit evidence.
3. **Assess:** determine whether authority, license, mapping, period, transformation, scoring, access, or presentation is affected.
4. **Recover:** restore the last approved release or publish a newly validated version.
5. **Communicate:** notify internal users of incorrect or stale decisions and the valid replacement.
6. **Learn:** publish a post-incident record with cause, impact, corrective actions, owners, and deadlines.

Security incidents additionally require credential revocation and the organization's formal security process, which is not defined in this repository.

## Reproducibility and change control

- Original files are immutable and content-addressed by SHA-256.
- Transformations, mappings, model definitions, and runtime configuration are versioned.
- The same inputs and versions must produce byte-equivalent canonical results or a documented deterministic equivalent.
- Published source, dataset, model, and validation versions are append-only.
- A change to meaning creates a new version; it is never hidden as a data correction.
- No operator or agent may invent missing values, undocumented weights, source metadata, licenses, or approval records.

## Operational evidence and open gaps

Import runs and audit events currently provide basic operational history; Sentry can capture server failures. Before production, the team still needs named owners, service objectives, alerts, backup/restore proof, secret rotation, access-review cadence, retention/deletion policy, and an organization-level security incident path.

