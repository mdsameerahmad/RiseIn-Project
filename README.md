# RiseIn Escrow — Decentralized Freelance Payment Platform

> **Trustless, milestone-based escrow payments powered by Soroban smart contracts on Stellar.**

RiseIn Escrow is a full-stack Web3 application that enables clients and freelancers to collaborate with trustless on-chain payment guarantees. Funds are locked in a Soroban smart contract and released incrementally as milestones are approved—no intermediaries, no delays, no trust required.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Repository Structure](#repository-structure)
4. [Module Deep-Dives](#module-deep-dives)
   - [contracts/ — Soroban Smart Contracts](#contracts--soroban-smart-contracts)
   - [backend/ — Node.js Indexer & REST API](#backend--nodejs-indexer--rest-api)
   - [frontend/ — Next.js Web Application](#frontend--nextjs-web-application)
5. [End-to-End Data Flow](#end-to-end-data-flow)
6. [Smart Contract Lifecycle](#smart-contract-lifecycle)
7. [Backend API Reference](#backend-api-reference)
8. [WebSocket Events](#websocket-events)
9. [Environment Variables](#environment-variables)
10. [Getting Started](#getting-started)
11. [Running Tests](#running-tests)
12. [Docker Deployment](#docker-deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Next.js 14 Frontend  (frontend/)                   │  │
│  │                                                              │  │
│  │  ┌──────────────┐   ┌─────────────────┐  ┌───────────────┐  │  │
│  │  │  Header.tsx  │   │  WalletContext   │  │  page.tsx     │  │  │
│  │  │  (Nav + CTA) │   │  (Freighter)    │  │  (Landing)    │  │  │
│  │  └──────────────┘   └────────┬────────┘  └───────────────┘  │  │
│  │                              │ Freighter Extension           │  │
│  └──────────────────────────────┼──────────────────────────────┘  │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ REST API + WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js Backend  (backend/)                      │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Express   │  │  Socket.IO   │  │  Indexer   │  │  MongoDB  │  │
│  │  REST API  │  │  (realtime)  │  │  Service   │  │  (Mongo)  │  │
│  └─────┬──────┘  └──────┬───────┘  └─────┬──────┘  └───────────┘  │
│        │                │                 │ polls every 8s          │
└────────┼────────────────┼─────────────────┼─────────────────────────┘
         │                │                 │ Soroban RPC
         │                │                 ▼
┌────────┼────────────────┼─────────────────────────────────────────┐
│        │                │     Stellar / Soroban Network           │
│        │                │                                         │
│        │                │  ┌─────────────────────────────────┐   │
│        │                │  │       contracts/ (Rust)          │   │
│        │                │  │                                  │   │
│        │                │  │  ┌──────────┐  ┌────────────┐   │   │
│        │                │  │  │  Escrow  │  │  Dispute   │   │   │
│        │                │  │  │ Contract │◄►│  Contract  │   │   │
│        │                │  │  └─────┬────┘  └────────────┘   │   │
│        │                │  │        │cross-contract calls     │   │
│        │                │  │  ┌─────▼──────────────────────┐ │   │
│        │                │  │  │    Reputation Contract      │ │   │
│        │                │  │  └────────────────────────────┘ │   │
│        │                │  └─────────────────────────────────┘   │
└────────┴────────────────┴─────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contracts | Rust + Soroban SDK | `no_std` WASM |
| Backend Runtime | Node.js + TypeScript | 20 LTS / TS 5 |
| Backend Framework | Express.js | 4.19 |
| Backend Database | MongoDB (via Mongoose) | 8.x |
| Backend Realtime | Socket.IO | 4.7 |
| Backend Validation | Zod | 3.x |
| Frontend Framework | Next.js (App Router) | 14.2 |
| Frontend Language | TypeScript + React | 18.x |
| Frontend Styling | Tailwind CSS | 3.4 |
| Frontend Wallet | Freighter API | 6.x |
| Stellar SDK | @stellar/stellar-sdk | 13–16 |
| Containerization | Docker (multi-stage) | Node 20 Alpine |

---

## Repository Structure

```
RiseIn/
├── contracts/                    # Rust/Soroban smart contracts (Cargo workspace)
│   ├── Cargo.toml                # Workspace manifest (escrow, reputation, dispute)
│   ├── escrow/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs            # Main escrow contract (768 lines)
│   ├── dispute/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs            # Dispute resolution contract (203 lines)
│   └── reputation/
│       ├── Cargo.toml
│       └── src/lib.rs            # On-chain reputation scoring (171 lines)
│
├── backend/                      # Node.js / TypeScript API server
│   ├── Dockerfile                # Multi-stage production Docker image
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── .env.example              # Required environment variables
│   └── src/
│       ├── app.ts                # Express app entry point, route registration
│       ├── config/
│       │   └── db.ts             # MongoDB connection with exponential backoff retry
│       ├── models/               # Mongoose schemas mirroring on-chain state
│       │   ├── Escrow.ts         # Escrow + embedded Milestone sub-documents
│       │   ├── Dispute.ts        # Dispute record with resolution
│       │   ├── User.ts           # User profile (wallet-keyed)
│       │   ├── Notification.ts   # Per-wallet notification feed
│       │   ├── EventLog.ts       # Idempotent blockchain event log
│       │   ├── ReputationCache.ts# Computed reputation snapshot
│       │   └── SyncState.ts      # Ledger cursor for indexer
│       ├── controllers/          # Route handler logic
│       │   ├── escrows.controller.ts
│       │   ├── users.controller.ts
│       │   ├── disputes.controller.ts
│       │   ├── reputation.controller.ts
│       │   ├── notifications.controller.ts
│       │   └── events.controller.ts
│       ├── routes/               # Express Router definitions
│       │   ├── escrows.routes.ts
│       │   ├── users.routes.ts
│       │   ├── disputes.routes.ts
│       │   ├── reputation.routes.ts
│       │   ├── notifications.routes.ts
│       │   └── events.routes.ts
│       ├── middleware/
│       │   ├── errorHandler.ts   # Centralized error response formatter
│       │   ├── validator.ts      # Zod body validation middleware factory
│       │   └── validationSchemas.ts # Zod schemas for all POST/PUT bodies
│       ├── services/
│       │   ├── soroban.ts        # Soroban RPC client — fetches + decodes events
│       │   └── indexer.ts        # Polling loop: ledger cursor → event processing
│       ├── sockets/
│       │   └── index.ts          # Socket.IO server — wallet-room pub/sub
│       └── tests/
│           ├── api.test.ts       # Supertest integration tests for all routes
│           ├── db.test.ts        # MongoDB connection and model tests
│           ├── indexer.test.ts   # Indexer event-processing unit tests
│           └── smoke.test.ts     # End-to-end smoke tests
│
└── frontend/                     # Next.js 14 App Router application
    ├── package.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── .env.example              # Required public environment variables
    └── src/
        ├── app/
        │   ├── layout.tsx        # Root layout: WalletProvider + Header wrapper
        │   ├── page.tsx          # Landing page: hero + "How It Works"
        │   └── globals.css       # Tailwind base styles
        ├── components/
        │   └── Header.tsx        # Sticky nav: logo, route links, wallet button
        └── lib/
            ├── wallet.ts         # Freighter API helpers (install check, connect, address)
            └── WalletContext.tsx # React context: global wallet state + persistence
```

---

## Module Deep-Dives

---

### `contracts/` — Soroban Smart Contracts

The contracts directory is a **Cargo workspace** containing three independent Soroban smart contracts compiled to WebAssembly (`wasm32-unknown-unknown`). All contracts are `#![no_std]` (no standard library) for minimal footprint and on-chain deployment.

#### Workspace Configuration (`Cargo.toml`)

```toml
[workspace]
resolver = "2"
members = ["escrow", "reputation", "dispute"]

[profile.release]
opt-level = "z"      # Size optimization
lto = true           # Link-time optimization
panic = "abort"      # No unwinding in WASM
```

---

#### `contracts/escrow/` — Core Escrow Contract

**File:** `src/lib.rs` (768 lines)

This is the **primary contract** and hub of the entire system. It manages the complete lifecycle of a freelance job agreement.

##### Data Types

| Type | Purpose |
|------|---------|
| `EscrowStatus` | `Created → Funded → InProgress → Completed / Disputed / Cancelled` |
| `MilestoneStatus` | `Pending → Submitted → Released` |
| `Milestone` | `{ milestone_id, description_hash: BytesN<32>, amount: i128, status }` |
| `Escrow` | `{ escrow_id, client, freelancer, token, total_amount, status, milestones: Vec<Milestone> }` |
| `Resolution` | `RefundClient | PayFreelancer | Split` — used by dispute callback |

##### Storage Layout

| Key | Storage Kind | Value |
|-----|-------------|-------|
| `DataKey::Admin` | Instance | `Address` |
| `DataKey::ReputationContract` | Instance | `Address` |
| `DataKey::DisputeContract` | Instance | `Address` |
| `DataKey::EscrowCounter` | Instance | `u64` (auto-increment) |
| `DataKey::Escrow(id)` | Persistent | `Escrow` struct |

##### Public Interface

| Function | Caller | Description |
|----------|--------|-------------|
| `init(admin, reputation, dispute)` | Admin | One-time initialization. Stores contract references. Panics if called twice. |
| `create_escrow(client, freelancer, token, milestones)` | Client | Creates a new escrow with N milestones. Emits `ContractCreated`. Returns `escrow_id`. |
| `fund_escrow(escrow_id, from)` | Client | Requires auth. Transfers `total_amount` tokens from client to contract. Status → `Funded`. Emits `Funded`. |
| `submit_milestone(escrow_id, milestone_id, freelancer)` | Freelancer | Marks a `Pending` milestone as `Submitted`. Status → `InProgress`. Emits `MilestoneSubmitted`. |
| `approve_milestone(escrow_id, milestone_id, client)` | Client | Marks milestone as `Released`. Transfers that milestone's token amount to freelancer. If all milestones released, triggers cross-contract `record_completion` on Reputation contract and sets status → `Completed`. Emits `MilestoneApproved` + `FundsReleased`. |
| `cancel_escrow(escrow_id, client)` | Client | Refunds full contract balance to client. Blocked if any milestone was approved. Emits `Cancelled`. |
| `raise_dispute(escrow_id, caller, reason, evidence_urls)` | Client or Freelancer | Freezes escrow (`Disputed`), forwards call to Dispute contract via cross-contract invoke. |
| `resolve_dispute_callback(escrow_id, resolution)` | Dispute Contract only | Called back by the dispute contract after arbitration. Distributes funds per `Resolution` enum. Status → `Completed`. |
| `get_escrow(escrow_id)` | Anyone | View query — returns `Escrow` struct. |

##### Cross-Contract Calls

```
Escrow::approve_milestone()
    └──► reputation::record_completion(freelancer, rating=5, on_time=true)

Escrow::raise_dispute()
    └──► dispute::raise_dispute(escrow_id, caller, reason, evidence_urls)

dispute::resolve_dispute()
    └──► Escrow::resolve_dispute_callback(escrow_id, resolution)
```

##### Events Emitted

| Event Name | Topic | Payload |
|------------|-------|---------|
| `ContractCreated` | `(Symbol, escrow_id)` | `ContractCreatedEvent { client, freelancer, totalAmount, milestones }` |
| `Funded` | `(Symbol, escrow_id)` | `total_amount: i128` |
| `MilestoneSubmitted` | `(Symbol, escrow_id)` | `MilestoneSubmittedEvent { milestoneId }` |
| `MilestoneApproved` | `(Symbol, escrow_id)` | `MilestoneApprovedEvent { milestoneId }` |
| `FundsReleased` | `(Symbol, escrow_id)` | `FundsReleasedEvent { milestoneId }` |
| `Cancelled` | `(Symbol, escrow_id)` | `contract_balance: i128` |

##### Test Coverage

The escrow `lib.rs` contains **8 integrated Rust tests** covering:
- `test_create_and_fund_escrow` — full creation and funding with balance verification
- `test_milestone_lifecycle_to_completion` — submit → approve → balance transfer
- `test_submit_milestone_by_wrong_address` — unauthorized address panics
- `test_double_approval_panics` — double-approve guard
- `test_cancel_escrow_refunds` — cancel refunds all tokens to client
- `test_cancel_escrow_after_approval_fails` — cancel blocked after milestone released
- `test_dispute_resolution_refund_client` — full dispute flow with real DisputeContract
- `test_real_reputation_cross_contract_integration` — end-to-end: escrow completion → on-chain reputation update

---

#### `contracts/dispute/` — Dispute Resolution Contract

**File:** `src/lib.rs` (203 lines)

An independent contract dedicated to **arbitration**. Escrow contracts invoke this to register disputes; a privileged `arbitrator` address resolves them.

##### Data Types

| Type | Description |
|------|------------|
| `DisputeStatus` | `Open | Resolved` |
| `Resolution` | `RefundClient | PayFreelancer | Split` |
| `Dispute` | `{ escrow_id, raised_by, reason, evidence_urls, status, resolution: Option<Resolution> }` |

##### Storage Layout

| Key | Value |
|-----|-------|
| `DataKey::Admin` | Admin address |
| `DataKey::EscrowContract` | Escrow contract address (caller whitelist) |
| `DataKey::Arbitrator` | Privileged resolver address |
| `DataKey::Dispute(escrow_id)` | `Dispute` struct (persistent) |

##### Public Interface

| Function | Caller | Description |
|----------|--------|-------------|
| `init(admin, escrow_contract, arbitrator)` | Admin | One-time init. Stores references. Panics on re-initialization. |
| `raise_dispute(escrow_id, raised_by, reason, evidence_urls)` | Escrow Contract only | Creates `Dispute` record with `Open` status. Emits `DisputeRaised`. Auth is verified against stored `EscrowContract` address — no arbitrary caller can open disputes. |
| `resolve_dispute(escrow_id, resolution)` | Arbitrator only | Sets dispute to `Resolved`. Invokes `Escrow::resolve_dispute_callback` to execute fund transfer. Emits `DisputeResolved`. |
| `get_dispute(escrow_id)` | Anyone | Returns `Option<Dispute>` — `None` if no dispute exists. |

##### Security Model

- `raise_dispute` requires `escrow_contract.require_auth()` — only the registered Escrow contract can open a dispute record, preventing spam.
- `resolve_dispute` requires `arbitrator.require_auth()` — only the designated arbitrator key can close disputes.

---

#### `contracts/reputation/` — On-Chain Reputation Contract

**File:** `src/lib.rs` (171 lines)

A simple, append-only reputation ledger. The **only** allowed writer is the registered Escrow contract, ensuring scores can only increase through legitimate contract completions.

##### Data Types

| Type | Description |
|------|------------|
| `ReputationScore` | `{ wallet_address, completed_contracts: u32, total_rating_points: u32, on_time_count: u32 }` |

##### Storage Layout

| Key | Value |
|-----|-------|
| `DataKey::Admin` | Admin address |
| `DataKey::EscrowContract` | Only authorized writer |
| `DataKey::Score(Address)` | `ReputationScore` per wallet (persistent) |

##### Public Interface

| Function | Caller | Description |
|----------|--------|-------------|
| `init(admin, escrow_contract)` | Admin | One-time initialization. |
| `record_completion(contractor, rating, on_time)` | Escrow Contract only | Increments `completed_contracts` and `total_rating_points`. Increments `on_time_count` if `on_time=true`. Rating must be 0–5. |
| `get_score(address)` | Anyone | Returns `ReputationScore` or zero-default if no record exists. |
| `set_escrow_contract(new_escrow)` | Admin | Admin-gated update for contract upgrades. |

##### Computed Metrics (from `total_rating_points / completed_contracts`)

> The average rating is computed off-chain (backend caches this) to avoid floating-point limitations in WASM contracts.

---

### `backend/` — Node.js Indexer & REST API

The backend is a **TypeScript Express.js** application serving two distinct roles:

1. **REST API** — provides cached, queryable access to on-chain state stored in MongoDB
2. **Blockchain Indexer** — polls the Soroban RPC every 8 seconds, decodes contract events, and syncs state into MongoDB

#### Startup Sequence (`src/app.ts`)

```
1. dotenv.config()
2. Express app created (CORS + JSON body parser)
3. API routes registered at /api/v1/*
4. Global error handler attached
5. http.Server wraps Express
6. Socket.IO initialized on http.Server (initSockets)
7. connectDB() → exponential backoff retry (up to 3 attempts)
8. startIndexer(8000) → 8-second polling loop starts
9. server.listen(PORT)
```

---

#### `src/config/db.ts` — Database Connection

Connects to MongoDB using Mongoose with **exponential backoff** retry logic:

```
Attempt 1 → wait 2s → Attempt 2 → wait 4s → Attempt 3 → fatal error
```

The `MONGODB_URI` env variable is required; the process exits loudly if it is missing or all retries fail.

---

#### `src/services/soroban.ts` — Soroban RPC Client

The `getContractEvents()` function wraps the Soroban RPC `getEvents` API:

```
getContractEvents(startLedger, contractIds[]) → DecodedEvent[]
```

**Process:**
1. Calls `rpcServer.getEvents({ startLedger, filters: [{ contractIds, type: 'contract' }], limit: 100 })`
2. For each raw event:
   - Decodes `event.topic[]` using `scValToNative()` → `[eventType: string, escrowId: number]`
   - Decodes `event.value` using `scValToNative()` → structured payload object
3. Returns typed `DecodedEvent[]` array

The `DecodedEvent` interface:
```typescript
interface DecodedEvent {
  eventType: string;      // e.g. "ContractCreated", "FundsReleased"
  escrowId: number;
  txHash: string;
  ledgerSequence: number;
  payload: any;           // decoded SC val → native JS object
}
```

---

#### `src/services/indexer.ts` — Blockchain Indexer

The indexer is the critical bridge between the Soroban blockchain and the MongoDB database.

##### Indexer Loop (`indexerLoop`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Every 8 seconds (startIndexer):                                 │
│                                                                  │
│  1. Read SyncState.lastLedger from MongoDB                       │
│  2. getContractEvents(lastLedger, [escrow, rep, dispute])        │
│  3. For each DecodedEvent:                                       │
│     a. Idempotency check: EventLog.findOne({txHash, eventType})  │
│        → if exists, skip (prevents duplicate processing)         │
│     b. Save new EventLog { processed: false }                    │
│     c. processEvent(event) → mutate MongoDB state                │
│     d. Mark EventLog { processed: true }                         │
│     e. Track maxLedger seen                                      │
│  4. Update SyncState.lastLedger = maxLedger + 1                  │
└──────────────────────────────────────────────────────────────────┘
```

##### Event Processing (`processEvent`)

| Event | MongoDB Action | Socket.IO Emission |
|-------|---------------|-------------------|
| `ContractCreated` | Upsert `Escrow` doc with milestones, status=`Created` | `escrow:created` → client & freelancer rooms |
| `Funded` | Set `Escrow.status = 'Funded'` | `escrow:updated` → client & freelancer rooms |
| `MilestoneSubmitted` | Set `milestone.status = 'Submitted'`, `milestones.$.submittedAt`, `Escrow.status = 'InProgress'` | `milestone:submitted` → client room + create `Notification` for client |
| `MilestoneApproved` | Set `milestone.status = 'Approved'`, `milestone.$.approvedAt` | `milestone:approved` → both rooms |
| `FundsReleased` | Set `milestone.status = 'Released'` | `escrow:updated` → both rooms + create `Notification` for freelancer |
| `DisputeRaised` | Set `Escrow.status = 'Disputed'`, upsert `Dispute` record | `dispute:raised` → both rooms |
| `DisputeResolved` | Set `Dispute.status = 'Resolved'`, `resolution`, `resolvedAt` | `dispute:resolved` → both rooms |

---

#### `src/sockets/index.ts` — Real-Time WebSocket Server

Uses Socket.IO rooms keyed by **lowercase wallet address**:

```
Client → emit('register', walletAddress)
Server → socket.join(walletAddress.toLowerCase())
Server → emit('registered', { success: true, room })

Indexer → emitToWallet(address, event, payload)
       → io.to(address.toLowerCase()).emit(event, payload)
```

This allows targeted, per-wallet push notifications when the indexer detects relevant on-chain events.

---

#### `src/models/` — MongoDB Schemas

| Model | Key Fields | Indexes |
|-------|-----------|---------|
| `Escrow` | `escrowId`, `client`, `freelancer`, `status`, `milestones[]`, `lastSyncedTxHash` | `escrowId` (unique), `client`, `freelancer` |
| `Dispute` | `escrowId`, `raisedBy`, `reason`, `evidenceUrls`, `status`, `resolution`, `resolvedAt` | `escrowId` |
| `User` | `walletAddress`, `displayName`, `bio`, `avatarUrl`, `role` | `walletAddress` (unique) |
| `Notification` | `walletAddress`, `message`, `relatedEscrowId`, `read` | `walletAddress`, compound `(walletAddress, read)` |
| `EventLog` | `eventType`, `escrowId`, `txHash`, `ledgerSequence`, `payload`, `processed` | compound `(txHash, eventType)` unique (idempotency), `(escrowId, createdAt)` |
| `ReputationCache` | `walletAddress`, `completedContracts`, `averageRating`, `onTimePercentage`, `lastSyncedAt` | `walletAddress` (unique) |
| `SyncState` | `lastLedger` | — (single document) |

---

#### `src/middleware/`

| File | Purpose |
|------|---------|
| `errorHandler.ts` | Express error middleware — maps `err.status` and `err.message` to JSON `{ success: false, error }` response |
| `validator.ts` | Factory function `validateBody(schema)` → middleware that runs `schema.safeParse(req.body)` and returns `400` with Zod error messages on failure |
| `validationSchemas.ts` | Zod schemas: `milestoneMetadataSchema`, `userProfileSchema`, `disputeSchema` |

---

### `frontend/` — Next.js Web Application

A **Next.js 14 App Router** application with React 18, Tailwind CSS, and Freighter wallet integration.

#### App Layout (`src/app/layout.tsx`)

The root layout wraps every page with:

```tsx
<WalletProvider>      ← global wallet state (React Context)
  <Header />          ← sticky navigation bar
  <main>
    {children}        ← page-specific content
  </main>
</WalletProvider>
```

**Metadata:**
- Title: `"RiseIn Escrow - Decentralized Freelance Payments"`
- Description: `"Secure, milestone-based escrow payments powered by Soroban on Stellar."`
- Font: Geist Sans + Geist Mono (local WOFF variable fonts)

---

#### `src/lib/wallet.ts` — Freighter API Helpers

Low-level wrappers around `@stellar/freighter-api`:

| Export | Description |
|--------|------------|
| `isFreighterInstalled()` | Calls `isConnected()` from freighter-api. Returns `false` on SSR or error. |
| `connectWallet()` | Checks install → calls `requestAccess()` → returns `{ publicKey: string }` |
| `getConnectedAddress()` | Calls `getAddress()` → returns current address string or `null` |

All three functions guard against SSR with `typeof window === 'undefined'` checks.

---

#### `src/lib/WalletContext.tsx` — Global Wallet State

React Context that provides wallet state to the entire app:

```typescript
interface WalletContextType {
  address: string | null;       // Stellar public key (G...)
  isConnected: boolean;         // !!address
  isInstalled: boolean;         // Freighter extension detected
  loading: boolean;             // Async operation in flight
  connect: () => Promise<string>;
  disconnect: () => void;
}
```

**Initialization flow (`useEffect` on mount):**
1. Check if Freighter is installed → `setIsInstalled`
2. Read `freighter_address` from `localStorage`
3. Call `getConnectedAddress()` to verify it still matches the active Freighter account
4. If match → restore session; if mismatch → clear stale key

**`connect()`:**
1. `setLoading(true)`
2. `connectWallet()` → Freighter popup
3. `setAddress(publicKey)` + persist to `localStorage`
4. `setLoading(false)`

**`disconnect()`:**
1. `setAddress(null)`
2. Remove `freighter_address` from `localStorage`

---

#### `src/components/Header.tsx` — Navigation Bar

Sticky `z-50` header with glassmorphism blur (`backdrop-blur-md`).

**Authenticated nav links (visible only when `isConnected`):**
- `/dashboard` — user dashboard
- `/create-escrow` — escrow creation form
- `/profile/{address}` — user profile page

**Wallet button states:**
- Not connected: gradient `Connect Wallet` button
- Loading: `Connecting...` (disabled)
- Connected: truncated address pill (`G12345...ABCD`) + `Disconnect` button

Fully responsive with a hamburger mobile menu that mirrors all desktop nav items.

---

#### `src/app/page.tsx` — Landing Page

A dark-themed (`bg-zinc-950`) landing page with:

1. **Hero Section** — gradient headline "Trustless Escrow for Decentralized Freelancing" with a conditional CTA:
   - Connected: `"Go to Dashboard"` link to `/dashboard`
   - Disconnected: `"Connect Wallet to Get Started"` button that calls `connect()`

2. **How It Works Section** — 3-step explainer cards with hover animations:
   - Step 1: Create Escrow & Milestones (purple)
   - Step 2: Fund & Work (pink)
   - Step 3: Approve & Release (indigo)

3. **Background decorations** — GPU-accelerated blurred gradient polygons for depth.

---

## End-to-End Data Flow

### Happy Path: Creating and Completing an Escrow

```
1. CLIENT connects Freighter wallet (browser)
   └── WalletContext.connect() → Freighter popup → publicKey stored

2. CLIENT creates escrow on-chain
   └── @stellar/stellar-sdk builds + signs transaction
   └── Submitted to Soroban RPC → escrow::create_escrow(...)
   └── Contract emits: ContractCreated event (ledger N)

3. BACKEND indexer (t+0 to t+8s)
   └── indexerLoop() detects ContractCreated at ledger N
   └── processEvent() → Escrow.findOneAndUpdate (upsert)
   └── emitToWallet(client, 'escrow:created', {escrowId})
   └── emitToWallet(freelancer, 'escrow:created', {escrowId})

4. CLIENT funds escrow
   └── escrow::fund_escrow(escrow_id, client) → token transfer to contract
   └── Emits: Funded event (ledger N+k)

5. BACKEND indexes Funded
   └── Escrow.status = 'Funded'
   └── Socket: escrow:updated → both parties

6. FREELANCER submits milestone
   └── escrow::submit_milestone(escrow_id, 1, freelancer)
   └── Emits: MilestoneSubmitted event

7. BACKEND indexes MilestoneSubmitted
   └── milestone[0].status = 'Submitted', submittedAt = now
   └── Escrow.status = 'InProgress'
   └── Socket: milestone:submitted → client room
   └── Notification: "Milestone #1 has been submitted..."

8. CLIENT approves milestone
   └── escrow::approve_milestone(escrow_id, 1, client)
   └── Token transfer: contract → freelancer (immediate, on-chain)
   └── Emits: MilestoneApproved, FundsReleased
   └── If last milestone: cross-contract → reputation::record_completion(freelancer, 5, true)
   └── Emits: Escrow status → Completed

9. BACKEND indexes MilestoneApproved + FundsReleased
   └── milestone[0].status = 'Released', 'Approved', approvedAt = now
   └── Socket: milestone:approved → both rooms
   └── Socket: escrow:updated → both rooms
   └── Notification: "Funds for milestone #1 released..."
```

### Dispute Path

```
CLIENT or FREELANCER raises dispute
   └── escrow::raise_dispute(escrow_id, caller, reason, evidenceUrls)
   └── Escrow status → Disputed
   └── Cross-contract: dispute::raise_dispute(escrow_id, ...)
   └── Emits: DisputeRaised

BACKEND indexes DisputeRaised
   └── Escrow.status = 'Disputed'
   └── Dispute record upserted (Open)
   └── Socket: dispute:raised → both rooms

ARBITRATOR resolves dispute
   └── dispute::resolve_dispute(escrow_id, Resolution::Split)
   └── Cross-contract callback: escrow::resolve_dispute_callback(escrow_id, Split)
   └── Funds split 50/50 between client and freelancer
   └── Escrow status → Completed
   └── Emits: DisputeResolved

BACKEND indexes DisputeResolved
   └── Dispute.status = 'Resolved', resolution = 'Split', resolvedAt = now
   └── Socket: dispute:resolved { escrowId, resolution } → both rooms
```

---

## Smart Contract Lifecycle

```
EscrowStatus State Machine:

  ┌─────────┐
  │ Created │ ◄── create_escrow()
  └────┬────┘
       │ fund_escrow()
       ▼
  ┌────────┐
  │ Funded │
  └────┬───┘
       │ submit_milestone()
       ▼
  ┌────────────┐
  │ InProgress │ ◄── (stays InProgress across multiple milestone submissions)
  └──────┬─────┘
         │                                    │ raise_dispute()
         │ all milestones approved            ▼
         │                             ┌──────────┐
         │                             │ Disputed │
         │                             └────┬─────┘
         │                                  │ resolve_dispute_callback()
         ▼                                  │
  ┌───────────┐ ◄────────────────────────────┘
  │ Completed │
  └───────────┘

  From Created, Funded, or InProgress:
  cancel_escrow() → Cancelled (if no milestones released)
```

---

## Backend API Reference

Base URL: `http://localhost:5000/api/v1`

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns `{ status: "ok", db: "connected/disconnected" }`. HTTP 503 if MongoDB is down. |

### Escrows

| Method | Endpoint | Body / Query | Description |
|--------|----------|-------------|-------------|
| `GET` | `/escrows` | `?wallet=<address>` | List all escrows. Filter by `client` OR `freelancer` wallet address. |
| `GET` | `/escrows/:escrowId` | — | Get single escrow by numeric ID. |
| `POST` | `/escrows/:escrowId/metadata` | `{ milestoneId, description }` | Attach off-chain description text to a milestone (bypasses on-chain 32-byte hash limitation). |

### Users

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/users/:walletAddress` | — | Fetch user profile by Stellar wallet address. |
| `PUT` | `/users/:walletAddress` | `{ displayName?, bio?, avatarUrl?, role? }` | Upsert user profile. `role` must be `client`, `freelancer`, or `both`. |

### Reputation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/reputation/:walletAddress` | Returns cached reputation snapshot `{ completedContracts, averageRating, onTimePercentage }`. 404 if not yet synced. |

### Disputes

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/disputes` | `{ escrowId, raisedBy, reason, evidenceUrls? }` | Record a dispute (off-chain metadata complement to on-chain event). Validated with Zod. |

### Notifications

| Method | Endpoint | Query | Description |
|--------|----------|-------|-------------|
| `GET` | `/notifications` | `?wallet=<address>` | Fetch all notifications for a wallet, sorted newest first. |
| `PATCH` | `/notifications/:id/read` | — | Mark a notification as read. |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/events/:escrowId` | Retrieve full event history log for a given escrow ID. |

---

## WebSocket Events

Connect to `http://localhost:5000` with Socket.IO. After connecting, register your wallet:

```javascript
socket.emit('register', walletAddress);
socket.on('registered', ({ success, room }) => { /* confirmed */ });
```

### Inbound Events (Server → Client)

| Event | Payload | Trigger |
|-------|---------|---------|
| `escrow:created` | `{ escrowId }` | `ContractCreated` indexed |
| `escrow:updated` | `{ escrowId, status }` | `Funded`, `FundsReleased` indexed |
| `milestone:submitted` | `{ escrowId, milestoneId }` | `MilestoneSubmitted` indexed |
| `milestone:approved` | `{ escrowId, milestoneId }` | `MilestoneApproved` indexed |
| `dispute:raised` | `{ escrowId }` | `DisputeRaised` indexed |
| `dispute:resolved` | `{ escrowId, resolution }` | `DisputeResolved` indexed |

---

## Environment Variables

### Backend (`backend/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/escrow
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
ESCROW_CONTRACT_ID=<deployed-escrow-contract-address>
REPUTATION_CONTRACT_ID=<deployed-reputation-contract-address>
DISPUTE_CONTRACT_ID=<deployed-dispute-contract-address>
PORT=5000
CORS_ORIGIN=*
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_ESCROW_CONTRACT_ID=<deployed-escrow-contract-address>
NEXT_PUBLIC_REPUTATION_CONTRACT_ID=<deployed-reputation-contract-address>
NEXT_PUBLIC_DISPUTE_CONTRACT_ID=<deployed-dispute-contract-address>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

---

## Getting Started

### Prerequisites

- **Rust** (with `wasm32-unknown-unknown` target) and **Soroban CLI**
- **Node.js** 20 LTS + **npm**
- **MongoDB** (local or Atlas)
- **Freighter** browser extension (for frontend wallet)

### 1. Deploy Smart Contracts

```bash
# Install Soroban CLI
cargo install --locked soroban-cli

# Build all contracts
cd contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy to Testnet (repeat for each contract)
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrow.wasm \
  --network testnet \
  --source <YOUR_SECRET_KEY>

# Initialize escrow contract with deployed addresses
soroban contract invoke \
  --id <ESCROW_CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- init \
  --admin <ADMIN_ADDRESS> \
  --reputation_contract <REP_CONTRACT_ID> \
  --dispute_contract <DISPUTE_CONTRACT_ID>
```

### 2. Start the Backend

```bash
cd backend
cp .env.example .env
# Fill in contract IDs and MongoDB URI in .env

npm install
npm run dev
# Server: http://localhost:5000
```

### 3. Start the Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in contract IDs and backend URL

npm install
npm run dev
# App: http://localhost:3000
```

---

## Running Tests

### Smart Contracts (Rust)

```bash
cd contracts

# Run all contract tests
cargo test

# Run tests for a specific contract
cargo test -p escrow
cargo test -p dispute
cargo test -p reputation
```

### Backend (Jest + Supertest)

```bash
cd backend

# Run all tests (in-band to prevent port conflicts)
npm test

# Individual test files
npx jest src/tests/api.test.ts
npx jest src/tests/indexer.test.ts
npx jest src/tests/db.test.ts
npx jest src/tests/smoke.test.ts
```

> Backend tests use `mongodb-memory-server` — no real MongoDB required.

### Frontend

```bash
cd frontend
npx vitest run
```

---

## Docker Deployment

The backend includes a **multi-stage Dockerfile** for lean production images:

```bash
# Build the backend image
cd backend
docker build -t risein-backend .

# Run with environment variables
docker run -p 5000:5000 \
  -e MONGODB_URI="mongodb://..." \
  -e ESCROW_CONTRACT_ID="C..." \
  -e REPUTATION_CONTRACT_ID="C..." \
  -e DISPUTE_CONTRACT_ID="C..." \
  -e SOROBAN_RPC_URL="https://soroban-testnet.stellar.org" \
  risein-backend
```

**Docker build stages:**
1. **Builder** (`node:20-alpine`): `npm ci` + `tsc` → compiles TypeScript to `dist/`
2. **Production** (`node:20-alpine`): `npm ci --only=production` + copies `dist/` → minimal image

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Milestone hashes on-chain** | Milestone descriptions are stored as `BytesN<32>` (SHA-256 hash) on-chain to minimize ledger storage costs. Human-readable descriptions are stored off-chain in MongoDB via the `/metadata` endpoint. |
| **Idempotent indexer** | `EventLog` uses a compound unique index `(txHash, eventType)` to guarantee each blockchain event is processed exactly once, even if the indexer restarts mid-batch. |
| **Cross-contract call security** | The `Dispute` contract only accepts `raise_dispute()` calls from the registered `EscrowContract` address (enforced via `require_auth()`). Similarly, `Reputation` only accepts writes from the `EscrowContract`. |
| **Wallet-room WebSockets** | Socket.IO rooms are keyed by lowercase wallet address, so targeted notifications are delivered only to the relevant parties without broadcasting to all connected clients. |
| **MongoDB as read cache** | MongoDB mirrors on-chain state to enable fast, indexed queries (e.g., "all escrows for wallet X") that would be prohibitively expensive to compute on-chain. The blockchain is always the source of truth. |
| **Exponential backoff on DB** | The backend retries MongoDB connections up to 3 times with doubling delays (2s, 4s) before failing fast, improving resilience during transient startup races. |

---

*Built on Stellar / Soroban — where trustless payments meet a decentralized future.*
