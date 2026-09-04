# Project: FisioFlow CRM ↔ Totem Kiosk Synchronization & Attribution

## Architecture
- **Client (Totem Kiosk)**: React 19, TypeScript 5.7, Vite 6, Tailwind CSS, Dexie v4 (IndexedDB) PWA with `dexie-react-hooks`. Fully offline-capable, auto-recovering, with WebKit storage persistence protection (`navigator.storage.persist()`) and closest active event auto-selection.
- **Edge Backend**: Cloudflare Pages Functions (`functions/api/sync.ts`, `functions/api/health.ts`) running on Cloudflare edge runtime.
- **Database**: Neon PostgreSQL (`purple-union-72678311`), `production` branch, `sa-east-1` region, accessed via `@neondatabase/serverless`.
- **Database Schemas**:
  - `eventos`: `id (uuid PK)`, `organization_id (uuid)`, `nome (text)`, `categoria (text)`, `local (text)`, `data_inicio (date)`, `status (text)`, `participantes_previstos (int)`.
  - `participantes`: `id (uuid PK)`, `organization_id (uuid)`, `evento_id (uuid FK -> eventos.id)`, `nome (text)`, `contato (text)`, `instagram (text)`, `segue_perfil (boolean)`, `aceitou_comunicado (boolean)`, `created_at (timestamptz)`.
  - `leads`: `id (uuid PK)`, `organization_id (uuid)`, `nome (text)`, `telefone (text)`, `origem (text = 'totem_corrida')`, `estagio (text = 'aguardando')`, `interesse (text)`, `contact_id (uuid FK -> contacts.id)`, `metadata (jsonb)`.
  - `contacts`: `id (uuid PK)`, `organization_id (uuid)`, `telefone (text)`, `lifecycle_stage (enum)`, unique index on `(organization_id, telefone)`.
  - `patients`: `id (uuid PK)`, `organization_id (uuid)`, `nome (text)`, `telefone (text)`.
- **Active Triggers**:
  - `trg_lead_stage_to_contact_lifecycle`: Updates `contacts.lifecycle_stage` when `leads.estagio` changes.
  - `trg_lead_efetivado_to_patient`: Creates patient in `patients` when `leads.estagio = 'efetivado'` and links `contacts.primary_patient_id`.
- **Organization**: `00000000-0000-0000-0000-000000000001` (`Activity Fisioterapia`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Bidirectional Event Sync GET | `/api/sync` (GET) fetches active events for org `00000000-0000-0000-0000-000000000001` from Neon, formatting dates as `YYYY-MM-DD` | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Totem IndexedDB Event Persistence & Auto-Selection | Totem client pulls cloud events into Dexie IndexedDB `eventos` without PK collision, auto-selecting closest event to today | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Atomic CRM Lead Ingestion | `/api/sync` (POST) inserts runners into FisioFlow `leads` table with `origem = 'totem_corrida'`, `estagio = 'aguardando'`, formatted `interesse`, and JSONB `metadata` | M2 | ORIGINAL_REQUEST §R2 |
| F4 | Idempotency & Relational Integrity | Ingestion upserts into `participantes` with valid `evento_id`, and deduplicates in `leads` by `(organization_id, telefone, evento_id)` without duplicating or regressing stage | M2 | ORIGINAL_REQUEST §R2 |
| F5 | Contact Resolution & Triggers Activation | Ingestion links `leads.contact_id` to `contacts`, ensuring `trg_lead_stage_to_contact_lifecycle` and `trg_lead_efetivado_to_patient` fire correctly | M2 | ORIGINAL_REQUEST §R2 |
| F6 | Funnel Metrics Display | `EventManagementModal.tsx` calculates and displays 4 funnel metrics (Total Atendidos, Respostas/Em Contato, Convertidos em Clientes, Taxa de Conversão %) | M3 | ORIGINAL_REQUEST §R3 |
| F7 | Race Origin CSV Export | `src/services/csvExport.ts` includes race origin name/ID and CRM conversion status columns in export | M3 | ORIGINAL_REQUEST §R3 |
| F8 | Comprehensive E2E Testing Suite | Requirement-driven opaque-box test suite (Tiers 1-4) validating sync, lead ingestion, idempotency, funnel metrics, and offline resilience | M_E2E | ORIGINAL_REQUEST §Acceptance Criteria |
| F9 | TypeScript Build Verification | Project builds cleanly (`npm run build`) with zero TypeScript compiler diagnostics | M_Final | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_E2E | E2E Testing Track | Design test runner, test harness, and Tiers 1-4 test cases covering F1-F7; publish TEST_READY.md | none | DONE |
| M1 | Event Sync & IndexedDB Resilience | Implement `onRequestGet` in `functions/api/sync.ts` and client pull in `syncService.ts` & `App.tsx` (F1, F2) | none | DONE |
| M2 | Atomic CRM Lead Ingestion & Attribution | Implement `onRequestPost` in `functions/api/sync.ts` with atomic upsert to `participantes`, `leads`, `contacts`, metadata, and idempotency (F3, F4, F5) | M1 contracts | DONE |
| M3 | Funnel Metrics Dashboard & CSV Export | Implement funnel indicators in `EventManagementModal.tsx` and race attribution in `csvExport.ts` (F6, F7) | M1, M2 | DONE |
| M_Final | 100% E2E Pass & Adversarial Hardening | Pass 100% of Tiers 1-4 E2E tests, followed by Tier 5 adversarial coverage hardening; verify `npm run build` | M_E2E, M1, M2, M3 | DONE |

## Interface Contracts

### 1. `GET /api/sync`
- **Request**: Query params: `?organization_id=00000000-0000-0000-0000-000000000001` (optional, defaults to standard org ID).
- **Response**:
  ```json
  {
    "ok": true,
    "eventos": [
      {
        "id": "786ec561-bac1-471a-af67-817537d1328c",
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "nome": "Circuito das Estações - Etapa Outono",
        "categoria": "corrida",
        "local": "Parque Ibirapuera",
        "data_inicio": "2026-09-06",
        "status": "ativo",
        "participantes_previstos": 500
      }
    ],
    "funnel_stats": {
      "786ec561-bac1-471a-af67-817537d1328c": {
        "atendidos": 120,
        "em_contato": 45,
        "convertidos": 18
      }
    }
  }
  ```

### 2. `POST /api/sync`
- **Request**:
  ```json
  {
    "secret": "optional-sync-secret",
    "organization_id": "00000000-0000-0000-0000-000000000001",
    "eventos": [ ... ],
    "participantes": [
      {
        "id": "uuid-participante",
        "evento_id": "uuid-evento",
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

### 3. CRM Lead Ingestion Rule
- Table: `leads`
- Fields:
  - `organization_id`: `00000000-0000-0000-0000-000000000001`
  - `nome`: participante.nome
  - `telefone`: sanitized WhatsApp digits (e.g. `11987654321`)
  - `origem`: `'totem_corrida'`
  - `estagio`: `'aguardando'` (on initial insert; preserve existing if already advanced)
  - `interesse`: `'Atendimento de Massagem Esportiva - ' || evento.nome`
  - `metadata`: `jsonb` `{ "evento_id": evento.id, "evento_nome": evento.nome, "categoria": "corrida", "segue_perfil": participante.segue_perfil, "totem_kiosk": true }`
  - `contact_id`: FK to `contacts(id)` corresponding to `(organization_id, sanitized_telefone)`

### 4. Conversion Funnel Calculation
- `Total Atendidos`: Count of runners registered in the event (`participantes`).
- `Respostas / Em Contato`: Count of leads for that event where `estagio IN ('em_contato', 'avaliacao_agendada', 'avaliacao_realizada', 'efetivado')`.
- `Convertidos em Clientes`: Count of leads for that event where `estagio = 'efetivado'`.
- `Taxa de Conversão`: `(Convertidos em Clientes / Total Atendidos) * 100%`. If Total Atendidos == 0, return `0.0%`.

### 5. CSV Export Schema
Columns:
1. `Nome`
2. `WhatsApp`
3. `Instagram`
4. `Segue Perfil`
5. `Aceitou Termo`
6. `Data/Hora`
7. `Sincronizado`
8. `Corrida de Origem`
9. `ID da Corrida`
10. `Status de Conversão CRM`

## Code Layout
- `functions/api/sync.ts`: Cloudflare Pages Functions endpoint for `/api/sync` (handles GET for event pull + funnel stats, POST for atomic ingestion).
- `functions/api/health.ts`: Cloudflare Pages Functions health probe.
- `src/db/index.ts`: Dexie database schema definition and offline storage helpers.
- `src/services/syncService.ts`: Client offline sync queue, background syncing, and cloud event pulling.
- `src/services/csvExport.ts`: Client CSV export logic including race origin and CRM conversion status.
- `src/components/EventManagementModal.tsx`: Event manager UI modal displaying funnel metrics cards and runner list.
- `tests/e2e/`: E2E test runner, test harness, mock servers, and test tier definitions.
