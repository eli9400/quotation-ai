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

## Phase 1 - Data Quality & Normalization (Gardening Domain)
- [ ] Normalize area-unit aliases (`sqm`, `m2`, Hebrew variants) -> `sqm`.
- [ ] Normalize visit-unit aliases (`visit` / Hebrew variants) -> `point`.
- [ ] Define and enforce policy for green waste/transport unit (`package` or `fixed`, no `unknown`).
- [ ] Reduce canonical name noise and suffix fragments.
- [ ] Add robust outlier filtering before learning (IQR/percentile guard).
- [ ] Add automatic post-training audit report:
  - unknown units count
  - split of `meter` vs `sqm`
  - itemKey fragmentation
  - outlier summary
- [ ] Re-run full training on 300 files after fixes.

Definition of Done:
- [ ] `pricing_items` has no `unit=unknown` for gardening scope.
- [ ] `unique itemKeys` is in expected range (about 45-80).
- [ ] Unit normalization no longer splits equivalent units.

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
- [ ] Phase 1: Unit normalization (`meter` vs `sqm`) and cleanup of unit aliases.
- [ ] Phase 1: Remove/convert remaining `unknown` unit rows in gardening data path.
- [ ] Phase 1: Add post-training audit output and validate on a new medium run (50 files).

---

## Session Log
- 2026-02-25:
  - Completed Phase 0 stability scope.
  - Deployed and validated new training UX and corrupted-file flow.
  - Confirmed successful training run (`ebc1c9e6-f81a-4d53-aec6-3edbb59bf016`) with `completed` status.
  - Identified Phase 1 quality gap: high `meter` usage alongside `sqm`, plus remaining `unknown` units.
