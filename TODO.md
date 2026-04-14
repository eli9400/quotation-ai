# Quotation AI - TODO Roadmap

Last updated: 2026-04-14  
Overall status: In Progress

---

## Working Rules
- Work phase by phase.
- Mark completed tasks with `[x]`.
- Do not move to the next phase before `Definition of Done` is met.
- Log every completed session in `Session Log`.

---

## Phase 0 - Stability Before Advanced ML
- [x] Deploy API + frontend with `latest-running` recovery behavior.
- [x] Enforce server-side block for concurrent training (`409` on running job).
- [x] Hide client form editor while training is running and refresh after completion.
- [x] Improve training UX:
  - upload loader while files are uploading
  - visible stage list (no internal scrolling)
  - green checkmark for completed stages
- [x] Add `Clear files` action (bulk remove pending files).
- [x] Add upload feedback for duplicates/new files count.
- [x] Add corrupted-file validation flow:
  - validate after upload
  - mark each file (`valid/corrupted/checking/unchecked`)
  - show reason for corrupted files
  - train only on valid files
  - auto re-validate after refresh/login
- [x] Run smoke tests:
  - token expiry/re-auth flow
  - refresh and logout/login during training
  - mixed upload (valid + duplicate + corrupted)
  - successful end-to-end training run

Definition of Done:
- [x] No concurrent training can start.
- [x] UI recovers correctly after refresh/logout/login.
- [x] Corrupted files are visible and excluded from training.
- [x] End-to-end flow is stable in production API.

Phase status: **Completed**

---

## Phase 1 - Data Quality & Normalization (Global, All Service Providers)
- [x] Priority 1: Add hard data validation gate before normalization.
- [x] Priority 1: Drop rows with invalid/missing unit when unit cannot be normalized to allowed taxonomy.
- [x] Priority 1: Drop rows with `quantity <= 0` or `pricePerUnit <= 0`.
- [x] Priority 1: Drop rows with hard extreme values (`pricePerUnit > 10x median` or `< 0.1x median`) per `(itemKey, unit)`.
- [x] Priority 1: Add regression test that punctuation variants (same phrase with and without `/`) map to the same canonical `itemKey`.
- [x] Priority 1: Add approved-quote mapping regression test to ensure canonical `itemKey` remains stable for punctuation variants.
- [x] Priority 2: Normalize area-unit aliases (`sqm`, `m2`, Hebrew variants) -> `sqm`.
- [x] Priority 2: Normalize visit-unit aliases (`visit` / Hebrew variants) -> `point`.
- [x] Priority 2: Define and enforce green waste/transport unit policy (`package`/`fixed`, no `unknown`).
- [x] Priority 2: Reject rows with units outside the allowed taxonomy after normalization.
- [x] Priority 3: Remove parenthesis fragments and unit suffix fragments from canonical names.
- [x] Priority 3: Normalize plural/singular and strip stopwords (`כולל`, `עבודה`, `ביקור`, `מחיר קבוע`).
- [x] Priority 3: Merge near-duplicate canonical names before final `itemKey`.
- [x] Priority 4: Add robust outlier filtering before learning (IQR/percentile guard).
- [x] Priority 5: Add automatic post-training audit report:
  - unknown units count
  - unit distribution (`meter` vs `sqm` + other units)
  - itemKey fragmentation
  - outlier summary
  - dropped rows summary by reason
- [x] Priority 6: Re-run medium training on 50 files after fixes.
- [x] Priority 6: Re-run full training on 300 files only after 50-file run passes.

Definition of Done:
- [x] `pricing_items` has no `unit=unknown` in active provider datasets.
- [x] Invalid rows (`unit/price/quantity`) are blocked before learning.
- [x] Unit normalization no longer splits equivalent units across providers.
- [x] Gardening `unique itemKeys` is in expected range (about 45-80).
- [x] Training audit report is generated for each completed run.

Phase status: **Completed**

---

## Phase 2 - Dataset Governance
- [x] Add dataset version id per training job.
- [x] Persist fixed snapshot metrics per run.
- [x] Add dataset fingerprint/hash for deterministic run comparison.
- [x] Add drift check vs previous run.

Definition of Done:
- [x] Every completed training job stores dataset snapshot metadata.
- [x] Snapshot includes deterministic fingerprint + version id.
- [x] Drift summary is computed against previous completed run when baseline exists.
- [x] Governance metadata is generated for both uploaded-document and approved-quote dataset paths.

Phase status: **Completed**

---

## Phase 3 - Evaluation Harness
- [x] Define metrics: `MAE`, `MAPE`, `SMAPE`, `MedianAE`.
- [x] Add time-based split + random split evaluation.
- [x] Add baseline rule model (median/quantile by item/unit).
- [x] Build eval script with JSON output + markdown summary.

Definition of Done:
- [x] Evaluation metrics are deterministic and covered by automated tests.
- [x] Evaluation runs on both random split and time-based split.
- [x] Baseline predictor supports direct item/unit lookup with unit/global fallback.
- [x] Evaluation report can be exported as JSON and markdown.

Phase status: **Completed**

---

## Phase 4 - Model V1 in Production
- [x] Train regression model V1 for `unitPrice` (initial `linear_quantity_v1`).
- [x] Freeze stable feature schema.
- [x] Save artifacts + metadata + metrics.
- [x] Add inference service with safe fallback.

Definition of Done:
- [x] Training script builds and persists an active model artifact per provider dataset snapshot.
- [x] Artifact includes dataset fingerprint/version, feature schema version, and evaluation metrics.
- [x] Inference path supports model prediction with safe fallback (no model -> existing pricing flow).
- [x] Backend tests and build pass after model integration.

Phase status: **Completed**

---

## Phase 5 - Advanced Model V2
- [ ] Add quantile modeling (`p25/p50/p75`).
- [ ] Add robust cold-start strategy for new items.
- [ ] Add uncertainty score and manual-review threshold.
- [ ] Improve controlled fuzzy merge for item variants.

---

## Phase 6 - Serving + UX
- [ ] Hybrid decision engine: Rules -> ML -> LLM explanation.
- [ ] Explainability at line-item level.
- [ ] Real-time anomaly warnings during quote generation.
- [ ] Ensure manual category overrides affect inference.

---

## Phase 7 - Monitoring & Continuous Retraining
- [ ] Scheduled retraining with canary rollout.
- [ ] Track prediction error vs approved quotes.
- [ ] Alerts on quality drop / drift increase.
- [ ] Fast rollback to previous model version.

---

## Phase 8 - Production Hardening
- [ ] Automated tests for parser/normalizer/training/inference.
- [ ] E2E tests for core user journeys.
- [ ] Backup + restore for training/model data.
- [ ] Security and secret management review.

---

## Next 3 (Immediate)
- [ ] Phase 5: Add quantile outputs (`p25/p50/p75`) and confidence-aware serving policy.
- [ ] Phase 5: Improve cold-start handling for unseen items/units across providers.
- [ ] Phase 5: Add uncertainty threshold that routes low-confidence lines to manual review.

---

## Session Log
- 2026-04-14:
  - Completed Phase 4 Model V1 production foundations:
    - Added provider-level model artifact storage (`model_artifacts`) with active-version switching and cache.
    - Implemented V1 regression trainer (`linear_quantity_v1`) with random/time evaluation metrics.
    - Added training script `server/scripts/train-model-v1.ts` and npm script `train:model:v1`.
    - Integrated model predictor with safe fallback into grounded pricing flow.
    - Validated end-to-end by training and activating model for provider `tJUQlidFsKeOWi3w8AFMQoWPdQG3`.
  - Started Phase 4 (Model V1 foundations):
    - Added global stable model feature schema contract (`v1`) shared by training/evaluation/inference paths.
    - Added feature-row mappers for dataset examples and inference inputs with strict validation.
    - Integrated schema validation into `evaluate-training-dataset` script before metric computation.
    - Wired inference-side schema validation into quote line autofill path (safe skip + warning on invalid rows).
    - Added automated tests for feature schema mapping, serialization, and validation behavior.
  - Completed Phase 3 evaluation harness:
    - Added deterministic metric service (`MAE`, `MAPE`, `SMAPE`, `MedianAE`) with automated tests.
    - Added random-split and time-split evaluators for training datasets.
    - Added baseline model evaluator with item/unit median prediction and fallback tracking.
    - Added `server/scripts/evaluate-training-dataset.ts` with JSON + markdown export.
    - Published first evaluation report for provider `tJUQlidFsKeOWi3w8AFMQoWPdQG3` under `server/reports/`.
  - Completed Phase 2 dataset governance foundations:
    - Added deterministic dataset fingerprint and dataset version id.
    - Persisted fixed dataset snapshot metrics on completed training jobs.
    - Added automatic drift summary versus previous completed run.
    - Added governance tests and integrated metadata into dataset stats refresh flows.
  - Completed Phase 1 DoD on production-like runs (50-file and large ~300-file validation path).
  - Cleaned duplicate/noisy provider pricing items and verified `unit=unknown` is zero.
  - Added global provider-vs-industry preference: when provider has equivalent item, hide industry/catalog duplicate in line-items API.
  - Refactored Firebase Admin credential bootstrap:
    - Option A: `FIREBASE_SERVICE_ACCOUNT_PATH`
    - Option B: `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
    - Kept ADC compatibility for Cloud Run (`FIREBASE_USE_ADC=true`)
  - Added `firebase-service-account.example.json`, updated env templates, and rewrote README onboarding docs.
  - Added automated Firestore post-training quality audit script for provider datasets and pricing items.
  - Added `pass/warn/fail` checks for unknown units, suspicious names, exact duplicates, near-duplicates, and job document coverage.
  - Added optional expectation ranges for dataset rows, pricing items, and unique item keys.
  - Added automated tests for the audit service and passed backend `typecheck` + `test`.
- 2026-02-25:
  - Completed Phase 0 stability scope.
  - Deployed and validated new training UX and corrupted-file flow.
  - Confirmed successful training run (`ebc1c9e6-f81a-4d53-aec6-3edbb59bf016`) with `completed` status.
  - Identified Phase 1 quality gap: high `meter` usage alongside `sqm`, plus remaining `unknown` units.
  - Updated Phase 1 scope/order to global cross-provider policy with `Drop bad data` as highest priority.
  - Implemented validation gate before normalization (`invalid unit/quantity/price` + hard median outlier drop).
  - Added automatic training audit report log (`unknown units`, unit distribution, fragmentation, outliers, dropped-by-reason).
  - Added regression tests for canonical `itemKey` stability across punctuation variants in both canonicalization and approved-quote mapping.

  - Added global unit taxonomy hardening (sqm/point alias expansion, transport rows -> package, reject unresolved unknown).
  - Added canonical name cleanup before training keying (parenthesis removal, stopword stripping, plural->singular normalization, unit suffix trimming).
  - Added near-duplicate `itemKey` merge policy (order-insensitive token key with weak-token suppression).
  - Added validation/unit regression tests and passed server `test` + `typecheck`.
  - Added robust outlier filtering (IQR + percentile bounds) on top of hard median thresholds in validation gate.
  - Re-ran 50-file training after Phase 1 fixes and validated logs (`validation gate` + `audit report`) on production API.
  - Executed post-training Firestore cleanup for plumber provider and removed remaining noisy/duplicate pricing items.
  - Added water-point install-prefix normalization (`install/התקנת`) to merge punctuation/prefix variants globally.
  - Verified final plumber dataset quality in Firestore: no exact duplicates, no near-duplicates, no suspicious generic names, and no `unit=unknown`.
  - Added hard service-alias canonicalization (`service/callout/visit` -> `ביקור שירות|point`) and anti-overmerge guard for distinguishing tokens (e.g., faucet `ניל` variant).
