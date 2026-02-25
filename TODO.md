# Quotation AI - TODO Roadmap

Last updated: 2026-02-25  
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
- [x] Priority 1: Add regression test that punctuation variants (e.g. `נקודת מים ביוב` vs `נקודת מים /ביוב`) map to the same canonical `itemKey`.
- [x] Priority 1: Add approved-quote mapping regression test to ensure canonical `itemKey` remains stable for punctuation variants.
- [ ] Priority 2: Normalize area-unit aliases (`sqm`, `m2`, Hebrew variants) -> `sqm`.
- [ ] Priority 2: Normalize visit-unit aliases (`visit` / Hebrew variants) -> `point`.
- [ ] Priority 2: Define and enforce green waste/transport unit policy (`package`/`fixed`, no `unknown`).
- [ ] Priority 2: Reject rows with units outside the allowed taxonomy after normalization.
- [ ] Priority 3: Remove parenthesis fragments and unit suffix fragments from canonical names.
- [ ] Priority 3: Normalize plural/singular and strip stopwords (`כולל`, `עבודה`, `ביקור`, `מחיר קבוע`).
- [ ] Priority 3: Merge near-duplicate canonical names before final `itemKey`.
- [ ] Priority 4: Add robust outlier filtering before learning (IQR/percentile guard).
- [x] Priority 5: Add automatic post-training audit report:
  - unknown units count
  - unit distribution (`meter` vs `sqm` + other units)
  - itemKey fragmentation
  - outlier summary
  - dropped rows summary by reason
- [ ] Priority 6: Re-run medium training on 50 files after fixes.
- [ ] Priority 6: Re-run full training on 300 files only after 50-file run passes.

Definition of Done:
- [ ] `pricing_items` has no `unit=unknown` in active provider datasets.
- [ ] Invalid rows (`unit/price/quantity`) are blocked before learning.
- [ ] Unit normalization no longer splits equivalent units across providers.
- [ ] Gardening `unique itemKeys` is in expected range (about 45-80).
- [ ] Training audit report is generated for each completed run.

Phase status: **In Progress**

---

## Phase 2 - Dataset Governance
- [ ] Add dataset version id per training job.
- [ ] Persist fixed snapshot metrics per run.
- [ ] Add dataset fingerprint/hash for deterministic run comparison.
- [ ] Add drift check vs previous run.

---

## Phase 3 - Evaluation Harness
- [ ] Define metrics: `MAE`, `MAPE`, `SMAPE`, `MedianAE`.
- [ ] Add time-based split + random split evaluation.
- [ ] Add baseline rule model (median/quantile by item/unit).
- [ ] Build eval script with JSON output + markdown summary.

---

## Phase 4 - Model V1 in Production
- [ ] Train regression model (CatBoost/XGBoost) for `unitPrice`.
- [ ] Freeze stable feature schema.
- [ ] Save artifacts + metadata + metrics.
- [ ] Add inference service with safe fallback.

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
- [ ] Phase 1: Implement data validation gate (drop invalid unit/price/quantity + hard extreme rows).
- [ ] Phase 1: Enforce global unit taxonomy (normalize + reject non-taxonomy units).
- [ ] Phase 1: Add training audit output and validate on a new medium run (50 files).

---

## Session Log
- 2026-02-25:
  - Completed Phase 0 stability scope.
  - Deployed and validated new training UX and corrupted-file flow.
  - Confirmed successful training run (`ebc1c9e6-f81a-4d53-aec6-3edbb59bf016`) with `completed` status.
  - Identified Phase 1 quality gap: high `meter` usage alongside `sqm`, plus remaining `unknown` units.
  - Updated Phase 1 scope/order to global cross-provider policy with `Drop bad data` as highest priority.
  - Implemented validation gate before normalization (`invalid unit/quantity/price` + hard median outlier drop).
  - Added automatic training audit report log (`unknown units`, unit distribution, fragmentation, outliers, dropped-by-reason).
  - Added regression tests for canonical `itemKey` stability across punctuation variants in both canonicalization and approved-quote mapping.
