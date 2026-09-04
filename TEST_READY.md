# TEST_READY: Totem Kiosk ↔ FisioFlow CRM E2E Test Suite

## 1. Test Suite Status & Overview

The end-to-end (E2E) opaque-box test suite for the **Totem Kiosk** and **FisioFlow CRM** integration is fully implemented, verified, and active.

- **Status**: **READY** (Test harness, CLI runner, and Tiers 1–4 test cases established).
- **Execution Target**: Standalone Node.js (v20+ / v24+), zero browser dependencies, fully headless and hermetic.
- **Dual-Mode Engine**: Hermetic in-memory relational PostgreSQL store with trigger emulation (`trg_lead_stage_to_contact_lifecycle`, `trg_lead_efetivado_to_patient`) + optional `--live-db` support for Neon cloud testing.

---

## 2. Test Execution Commands

### Primary Command
```bash
node tests/e2e/runner.js
```

### Targeted Execution by Tier
```bash
# Tier 1: Core Feature Coverage (GET /api/sync, POST lead ingestion, idempotency, funnel math, CSV export)
node tests/e2e/runner.js --tier=1

# Tier 2: Boundary & Corner Cases (Empty DB, offline backoff, dirty phones, null fields, zero division)
node tests/e2e/runner.js --tier=2

# Tier 3: Cross-Feature Combinations (Offline reg -> Sync -> CRM progression -> Patient trigger -> Funnel update)
node tests/e2e/runner.js --tier=3

# Tier 4: Real-World Scenarios (50 runners batch rush, runner re-submitting with modified data, multiple races)
node tests/e2e/runner.js --tier=4
```

### Filtering & Diagnostic Modes
```bash
# Run tests matching a specific pattern
node tests/e2e/runner.js --filter=idempotency
node tests/e2e/runner.js --filter=math

# Enable verbose stack traces
node tests/e2e/runner.js --verbose

# Machine-readable JSON output
node tests/e2e/runner.js --json

# Test directly against live Neon PostgreSQL (requires DATABASE_URL)
node tests/e2e/runner.js --live-db
```

---

## 3. Tier Breakdown & Test Inventory

### Tier 1: Feature Coverage (Interface & Functional Contracts)
| Test ID | Test Name | Target Contract | Description |
|---------|-----------|-----------------|-------------|
| T1.1 | `test_get_sync_event_retrieval` | `PROJECT.md §Contract 1` | Validates `GET /api/sync` returns HTTP 200, active events with `YYYY-MM-DD` dates, and `funnel_stats` mapping. |
| T1.2 | `test_closest_event_auto_selection` | `PROJECT.md §F2` | Validates `findClosestEvent` picks the closest active event to today's date, ignoring concluded events. |
| T1.3 | `test_post_sync_atomic_lead_ingestion` | `PROJECT.md §Contract 2 & 3` | Validates `POST /api/sync` inserts into `participantes` and `leads` with `origem = 'totem_corrida'`, `estagio = 'aguardando'`, and JSONB `metadata`. |
| T1.4 | `test_contact_link_and_trigger_activation` | `PROJECT.md §F5` | Validates `contacts` resolution, foreign key linkage `leads.contact_id`, and `trg_lead_stage_to_contact_lifecycle` trigger activation. |
| T1.5 | `test_idempotency_deduplication` | `PROJECT.md §F4` | Validates repeated submissions with the same phone update records without creating duplicate leads or regressing stage. |
| T1.6 | `test_conversion_funnel_metrics_math` | `PROJECT.md §Contract 4` | Validates calculations for Atendidos, Em Contato, Convertidos, and Conversion Rate (%). |
| T1.7 | `test_csv_export_fields_and_attribution` | `PROJECT.md §Contract 5` | Validates CSV export headers, Title Case name formatting, and Brazilian/WhatsApp phone normalization. |

### Tier 2: Boundary & Corner Cases
| Test ID | Test Name | Target Contract | Description |
|---------|-----------|-----------------|-------------|
| T2.1 | `test_empty_database_handling` | `PROJECT.md §Contract 1 & 2` | Verifies 0 events, 0 participants, and empty CSV exports handle cleanly without exceptions. |
| T2.2 | `test_network_offline_resilience` | `PROJECT.md §Architecture` | Verifies client exponential backoff retry algorithm `min(2^n, 30)` under offline/failure conditions. |
| T2.3 | `test_malformed_phone_numbers` | `PROJECT.md §Contract 3` | Verifies phone sanitization with whitespace, +55 international prefixes, non-digit extensions, and edge cases. |
| T2.4 | `test_null_and_missing_optional_fields` | `PROJECT.md §Contract 2` | Verifies participants with null Instagram, empty observations, and missing event fields ingest safely. |
| T2.5 | `test_zero_attendees_zero_division_protection` | `PROJECT.md §Contract 4` | Verifies funnel conversion rate calculation returns `0.0%` when attendees = 0 without `NaN%` or division error. |

### Tier 3: Cross-Feature Combinations
| Test ID | Test Name | Target Contract | Description |
|---------|-----------|-----------------|-------------|
| T3.1 | `test_offline_registration_to_crm_progression_lifecycle` | `ORIGINAL_REQUEST §R1-R3` | Multi-step lifecycle: Offline kiosk registration → Cloud sync → CRM Lead (`aguardando`) → Advance to `em_contato` (contact `mql`) → Advance to `efetivado` (auto-creates `patients`) → Funnel stats update. |
| T3.2 | `test_multi_event_concurrent_sync` | `PROJECT.md §Contract 2 & 4` | Verifies concurrent registrations across different events remain strictly partitioned in leads, metadata, and analytics. |
| T3.3 | `test_re_sync_after_partial_failure` | `ORIGINAL_REQUEST §R2` | Verifies resuming an interrupted sync queue re-submits pending records without duplicating previously synced items. |

### Tier 4: Real-World Application Scenarios
| Test ID | Test Name | Target Contract | Description |
|---------|-----------|-----------------|-------------|
| T4.1 | `test_race_day_high_volume_batch_ingestion` | `ORIGINAL_REQUEST §R2` | Simulates 50 runners arriving at the kiosk during post-race rush; processed in 25-runner batches with 100% persistence and CRM ingestion. |
| T4.2 | `test_runner_resubmission_with_updated_data` | `ORIGINAL_REQUEST §R2` | Runner registers in morning, is contacted by clinic (`em_contato`), and re-submits in afternoon with updated Instagram; verifies CRM stage is preserved. |
| T4.3 | `test_multiple_active_races_clinic_scheduling` | `ORIGINAL_REQUEST §R1 & R3` | Clinic with multiple scheduled races in calendar; Totem kiosk selects closest upcoming race, attributes runner data, and isolates CSV export. |

---

## 4. Feature Coverage Checklist

- [x] **F1: Bidirectional Event Sync GET** (`GET /api/sync` active events with `YYYY-MM-DD` and `funnel_stats`) → Covered by `T1.1`, `T2.1`.
- [x] **F2: Totem Event Persistence & Auto-Selection** (`findClosestEvent` closest active race to today) → Covered by `T1.2`, `T2.1`, `T4.3`.
- [x] **F3: Atomic CRM Lead Ingestion** (`POST /api/sync` creates `leads` with `origem='totem_corrida'`, `estagio='aguardando'`, formatted `interesse`, JSONB `metadata`) → Covered by `T1.3`, `T2.4`, `T3.1`, `T4.1`.
- [x] **F4: Idempotency & Relational Integrity** (Upsert `participantes`, deduplicate `leads` by phone & event without stage regression) → Covered by `T1.5`, `T3.3`, `T4.2`.
- [x] **F5: Contact Resolution & Triggers Activation** (`contacts` table link, `trg_lead_stage_to_contact_lifecycle`, `trg_lead_efetivado_to_patient`) → Covered by `T1.4`, `T3.1`.
- [x] **F6: Funnel Metrics Math & Display** (Atendidos, Em Contato, Convertidos, Taxa de Conversão %) → Covered by `T1.6`, `T2.5`, `T3.1`.
- [x] **F7: Race Origin CSV Export** (Race name and ID in CSV export file, phone formatting, Title Case) → Covered by `T1.7`, `T2.1`, `T4.3`.
- [x] **F8: Comprehensive E2E Testing Suite** (Standalone runner, Tiers 1-4, multi-tier execution) → Covered by `runner.js`.

---

## 5. Implementation Status & Worker Targets

Running the test suite against the current codebase yields:
- **Passed: 10 tests** (M1 event retrieval, closest event auto-selection, funnel math, CSV export, empty DB handling, offline backoff, phone normalization, zero division, partial failure re-sync, multiple race scheduling).
- **Failed: 8 tests** (Targeting Milestone M2: Atomic CRM Lead Ingestion & Attribution).

### Escalation / Target for Milestone M2 Workers:
To make the remaining 8 tests pass, Milestone M2 must implement in `functions/api/sync.ts` (`onRequestPost`):
1. **Insert into `contacts` table**:
   - Query / upsert on `(organization_id, sanitized_telefone)`
   - Set `lifecycle_stage = 'lead'`
2. **Insert into `leads` table**:
   - Fields: `organization_id`, `nome`, `telefone` (sanitized WhatsApp digits), `origem = 'totem_corrida'`, `estagio = 'aguardando'`, `interesse = 'Atendimento de Massagem Esportiva - ' || evento.nome`, `contact_id = contacts.id`, `metadata = { evento_id, evento_nome, categoria: 'corrida', segue_perfil, totem_kiosk: true }`.
3. **Idempotency Deduplication**:
   - Check if lead already exists for `(organization_id, sanitized_telefone)` and `metadata->>'evento_id' = evento_id`.
   - If exists: update participant record, update lead metadata/notes if needed, but DO NOT create duplicate lead row and DO NOT overwrite/regress `estagio` if already advanced.
