# Test Infrastructure Specification: Totem Kiosk ↔ FisioFlow CRM

## 1. Overview & Architectural Principles

This document defines the architecture, test harness, execution framework, and test tiers for the end-to-end (E2E) opaque-box test suite of the **Totem Kiosk** (PWA Offline-First) and **FisioFlow CRM** (Neon PostgreSQL) integration.

### Core Testing Principles:
1. **Opaque-Box Testing**: All tests exercise public interfaces, API contracts (`/api/sync`), database states (`eventos`, `participantes`, `leads`, `contacts`, `patients`), business logic, and UI export artifacts strictly as black-box consumers against the requirements in `ORIGINAL_REQUEST.md` and `PROJECT.md`.
2. **Deterministic & Hermetic Execution**: Tests run in Node.js without requiring a physical browser or external cloud dependencies. A dual-mode test harness supports both an isolated, zero-dependency in-memory PostgreSQL engine (with schema validation, foreign key constraints, and PL/pgSQL triggers) and live Neon database connectivity when configured.
3. **Progressive Testability**: The test suite acts as an executable specification across milestones M1 (Event Sync & IndexedDB Resilience), M2 (Atomic CRM Lead Ingestion & Attribution), and M3 (Funnel Metrics & CSV Export). Unimplemented features fail gracefully with explicit descriptive assertion messages, providing clear implementation targets.
4. **Idempotency & Data Integrity**: Tests verify that repeated submissions, network re-syncs, and multi-tenant operations never cause primary key collisions, duplicate CRM leads, or state regressions.

---

## 2. Directory Layout & Write Ownership

```
splendid-mendel/
├── TEST_INFRA.md                 # Test infrastructure specification (owned by test suite creator)
├── TEST_READY.md                 # Test runner guide and readiness checklist (owned by test suite creator)
├── tests/
│   └── e2e/
│       ├── runner.js             # Main test runner CLI (Node.js ESM)
│       ├── harness.js            # Dual-mode test harness & DB/API mocks
│       ├── tier1-features.test.js    # Tier 1: Feature coverage
│       ├── tier2-boundaries.test.js  # Tier 2: Boundary & corner cases
│       ├── tier3-combinations.test.js# Tier 3: Cross-feature combinations
│       └── tier4-scenarios.test.js   # Tier 4: Real-world race day scenarios
├── functions/
│   └── api/
│       ├── sync.ts               # Cloudflare Pages Function (/api/sync)
│       └── health.ts             # Health probe endpoint (/api/health)
└── src/                          # Client PWA application code
```

**Ownership Rule**:
- `tests/e2e/**`, `TEST_INFRA.md`, and `TEST_READY.md` are exclusively owned by the E2E Test Suite Creator.
- Production source directories (`src/`, `functions/`) must NOT be modified by the test creator; implementation defects are escalated to milestone workers.

---

## 3. Test Runner & Execution Commands

The test suite is built on Node.js ES Modules and runs natively in modern Node (v20+):

### Basic Run Command
```bash
node tests/e2e/runner.js
```

### Targeted Execution by Tier
```bash
# Run only Tier 1 (Feature Coverage)
node tests/e2e/runner.js --tier=1

# Run only Tier 2 (Boundary & Corner Cases)
node tests/e2e/runner.js --tier=2

# Run only Tier 3 (Cross-Feature Combinations)
node tests/e2e/runner.js --tier=3

# Run only Tier 4 (Real-World Scenarios)
node tests/e2e/runner.js --tier=4
```

### Filtering by Name & Verbose Diagnostics
```bash
# Run specific test matching pattern
node tests/e2e/runner.js --filter=idempotency

# Run with verbose diagnostic logs
node tests/e2e/runner.js --verbose

# Run against live Neon database (requires DATABASE_URL)
node tests/e2e/runner.js --live-db
```

---

## 4. Test Harness Architecture

The test harness (`tests/e2e/harness.js`) provides a realistic execution environment:

### 4.1. Edge Runtime Emulation
Cloudflare Pages Functions export handler functions:
- `onRequestGet(context)`
- `onRequestPost(context)`
- `onRequestOptions(context)`

The harness creates standard Web API `Request` and `Response` objects and injects an `env` object containing `DATABASE_URL` and `SYNC_SECRET`.

### 4.2. Dual-Mode PostgreSQL Engine
1. **Hermetic Mock Database (`MockPostgresDB`)**:
   - Implements in-memory relational tables matching FisioFlow: `organizations`, `eventos`, `participantes`, `leads`, `contacts`, `patients`, `contact_activities`.
   - Enforces foreign keys (`participantes.evento_id -> eventos.id`, `leads.contact_id -> contacts.id`).
   - Enforces unique index `uq_contacts_org_phone` on `(organization_id, telefone)`.
   - Implements PostgreSQL triggers:
     - `trg_lead_stage_to_contact_lifecycle`: Updates `contacts.lifecycle_stage` when `leads.estagio` changes (`aguardando` → `lead`, `em_contato` → `mql`, `avaliacao_agendada` → `sql`, `avaliacao_realizada` → `opportunity`, `efetivado` → `customer`, `nao_efetivado` → `churned`).
     - `trg_lead_efetivado_to_patient`: Creates a record in `patients` when a lead reaches `efetivado` and links `contacts.primary_patient_id`.
   - Translates SQL tagged template literals into atomic operations, supporting `INSERT ... ON CONFLICT`, `UPDATE`, `SELECT`, and JSONB operators.
2. **Live Neon Database Mode**:
   - When `--live-db` is specified and `DATABASE_URL` is set, queries are executed against the Neon test endpoint. All test entities use prefix `test-e2e-` and are automatically deleted during teardown.

### 4.3. Headless Client Emulation
- Provides DOM stubs (`document.createElement`, `URL.createObjectURL`, `Blob`) to test CSV export formatting in `src/services/csvExport.ts` without browser rendering.
- Emulates Dexie IndexedDB collections and offline queues for testing synchronization retries and network event handlers.

---

## 5. Specification & Interface Contracts

### 5.1. `GET /api/sync`
- **Request**: Query parameter `?organization_id=00000000-0000-0000-0000-000000000001`
- **Response**:
  ```json
  {
    "ok": true,
    "eventos": [
      {
        "id": "uuid",
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "nome": "Circuito das Estações",
        "categoria": "corrida",
        "local": "Parque Ibirapuera",
        "data_inicio": "YYYY-MM-DD",
        "status": "ativo",
        "participantes_previstos": 500
      }
    ],
    "funnel_stats": {
      "<evento_id>": {
        "atendidos": 120,
        "em_contato": 45,
        "convertidos": 18
      }
    }
  }
  ```

### 5.2. `POST /api/sync`
- **Request**:
  ```json
  {
    "organization_id": "00000000-0000-0000-0000-000000000001",
    "eventos": [ ... ],
    "participantes": [
      {
        "id": "uuid",
        "evento_id": "uuid",
        "nome": "Corredor Exemplo",
        "contato": "(11) 98765-4321",
        "instagram": "@corredor",
        "segue_perfil": true,
        "aceitou_comunicado": true,
        "created_at": "2026-09-04T19:00:00.000Z"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "processed_count": 1,
    "synced_leads": 1,
    "errors": []
  }
  ```

### 5.3. CRM Lead Ingestion & Attribution Rules
- Target Table: `leads`
- Ingested fields:
  - `organization_id`: `00000000-0000-0000-0000-000000000001`
  - `nome`: participant's full name
  - `telefone`: sanitized WhatsApp digits (e.g. `11987654321`)
  - `origem`: `'totem_corrida'`
  - `estagio`: `'aguardando'` (on initial creation; preserved if already advanced in CRM)
  - `interesse`: `'Atendimento de Massagem Esportiva - ' || evento.nome`
  - `metadata`: `{ "evento_id": evento.id, "evento_nome": evento.nome, "categoria": "corrida", "segue_perfil": boolean, "totem_kiosk": true }`
  - `contact_id`: Resolved FK to `contacts(id)` for `(organization_id, sanitized_telefone)`

### 5.4. Conversion Funnel Calculation Rules
- `Total Atendidos`: Count of participants in race (`participantes WHERE evento_id = ?`)
- `Respostas / Em Contato`: Count of leads where `estagio IN ('em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado')`
- `Convertidos em Clientes`: Count of leads where `estagio = 'efetivado'`
- `Taxa de Conversão`: `(Convertidos em Clientes / Total Atendidos) * 100%`. If `Total Atendidos == 0`, returns `0.0%` (safe against zero-division).

### 5.5. CSV Export Schema
Headers:
1. `Nome Completo`
2. `Telefone Formatado`
3. `WhatsApp Internacional (Excel Text)`
4. `Link Direto WhatsApp`
5. `Instagram`
6. `Segue Perfil?`
7. `Aceitou Comunicado LGPD?`
8. `Data de Cadastro`
9. `Horário`
10. `Status Nuvem`
11. `ID Único`
12. `Corrida de Origem`
13. `ID da Corrida`
14. `Status de Conversão CRM`

---

## 6. Tiered Test Strategy

### Tier 1: Feature Coverage (Core Functional Contracts)
Validates that every required feature (F1 through F7) functions in isolation according to the specification.
- **T1.1**: Event Sync GET (`onRequestGet` returns active events with `YYYY-MM-DD` and `funnel_stats`).
- **T1.2**: Event Auto-Selection (`findClosestEvent` picks the closest active race to today's date).
- **T1.3**: Atomic Lead Ingestion (`onRequestPost` populates `participantes` and `leads` with correct metadata).
- **T1.4**: Contact Linking & Lifecycle Triggers (contacts table resolution and stage-to-lifecycle trigger firing).
- **T1.5**: Idempotency Deduplication (re-submitting same runner updates existing records without duplication or stage regression).
- **T1.6**: Conversion Funnel Math (correct calculation of atendidos, em_contato, convertidos, and taxa %).
- **T1.7**: CSV Export Columns (export contains race name, race ID, and CRM conversion status).

### Tier 2: Boundary & Corner Cases
Validates stability under edge cases and extreme inputs.
- **T2.1**: Empty Database Handling (0 events, 0 participants, 0 leads return empty lists without crashing).
- **T2.2**: Network Offline Resilience (offline detection, queue persistence, and exponential backoff retry).
- **T2.3**: Malformed Phone Sanitization (parentheses, spaces, +55 prefixes, extra dashes, invalid non-digits).
- **T2.4**: Null and Missing Optional Fields (null instagram, null notes, missing event location handled gracefully).
- **T2.5**: Zero-Division Funnel Protection (0 attendees returns `0.0%` without `NaN` or `Infinity`).

### Tier 3: Cross-Feature Combinations
Validates multi-step workflows across systems.
- **T3.1**: Offline Registration → Online Sync → CRM Lead Creation → Lead Progression → Funnel Stats Update.
- **T3.2**: Multi-Event Concurrent Sync (runners from two events registered simultaneously remain strictly partitioned).
- **T3.3**: Partial Failure Recovery (batch of runners where one is retried later without duplicating successful ones).

### Tier 4: Real-World Application Scenarios
Simulates realistic clinic race day operations.
- **T4.1**: Race Day High Volume (50+ runners registered during peak post-race rush processed in chunks).
- **T4.2**: Runner Re-Submission with Modified Data (runner updates Instagram/opt-in later in the day while preserving CRM lead stage).
- **T4.3**: Multiple Active Races in Clinic (Totem selects the active race closest to today, isolating metrics and CSV exports).

---

## 7. Pass/Fail Criteria & Diagnostic Reporting

Each test case provides:
- Exact contract reference (e.g. `ORIGINAL_REQUEST §R2`, `PROJECT.md §Contract 3`)
- Expected value vs Observed value in case of failure
- Clear diagnostic trace identifying whether the failure is due to missing endpoint, missing field, trigger misconfiguration, or mathematical deviation.
