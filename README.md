# ReachInbox Cold Outreach Email Scheduler (Full-Stack Monorepo)

A production-grade cold outreach email scheduler and analytics dashboard designed to reliably schedule, rate-limit, and send emails via fake SMTP (Ethereal Email). Built with **Express.js, TypeScript, BullMQ, Redis, PostgreSQL (Prisma), Next.js (App Router), and Tailwind CSS**.

> ⚠️ **NO CRON POLICY**: This project strictly uses **BullMQ delayed jobs** backed by Redis persistence. No `cron`, `node-cron`, `agenda`, or OS crontabs exist anywhere in the codebase.

---

## 🏗️ Architecture Overview

### Scheduling & Execution Flow Diagram (ASCII)

```
[ User / Dashboard ] 
       │
       │ POST /api/emails/schedule (CSV / Recipients + Schedule Rules)
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Express API Server                                                     │
│ 1. Generates SHA-256 Idempotency Key: sender+recipient+campaign+time   │
│ 2. Writes Campaign & EmailJob (PENDING) to PostgreSQL                   │
│ 3. Enqueues Delayed Job in BullMQ Queue (delay = max(0, start - now))  │
└────────────────────────────────────────────────────────────────────────┘
       │
       │ BullMQ Delayed Trigger (Redis AOF Persistent)
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BullMQ Worker Process (worker.ts - Concurrency = WORKER_CONCURRENCY)   │
│ 1. Pickup Guard: Verify DB status is PENDING (skip if SENT/CANCELLED) │
│ 2. Rate Limit Check: Redis INCR sender:{id}:hour:{YYYY-MM-DDTHH}       │
│    └─ If Limit Exceeded: Shift scheduledTime to next hour window       │
│ 3. Inter-Send Delay: Check Redis timestamp sender:{id}:lastSentAt       │
│ 4. Send via Nodemailer Ethereal SMTP Transport                        │
│ 5. Atomic Update: DB status -> SENT + Ethereal Preview URL             │
└────────────────────────────────────────────────────────────────────────┘
       │
       ▼
[ Ethereal Sandbox Inbox Preview URL ]
```

---

## 🔒 Concurrency, Idempotency & Rate Limiting

1. **Worker Concurrency**:
   - Worker runs with `Worker(queueName, processor, { concurrency: Number(process.env.WORKER_CONCURRENCY || 5) })`.
   - Thread safety is guaranteed via atomic Redis counter increments (`INCR` with TTL) and PostgreSQL transaction status checks.

2. **Idempotency Guard**:
   - Each `EmailJob` has a unique SHA-256 hash `idempotencyKey` created before enqueuing.
   - On worker pickup, the worker inspects `EmailJob.status`. If already `SENT` or `CANCELLED`, the worker acknowledges the job and skips sending immediately, preventing double delivery even if BullMQ retries a job.

3. **Sliding Hourly Rate Limiting**:
   - Implemented via a Redis key `sender:{senderId}:hour:{YYYY-MM-DDTHH}` using `INCR` and `EXPIRE`.
   - If the limit (`MAX_EMAILS_PER_HOUR_PER_SENDER`) is reached, the worker reschedules the job to the start of the next hour window (`job.moveToDelayed` / new delay) without dropping or failing the job.

4. **Minimum Inter-Send Delay**:
   - Default chosen value: **`2000ms` (2 seconds)** per sender.
   - Preserves sender domain reputation and prevents SMTP burst flags. Stored in Redis `sender:{senderId}:lastSentAt`.

5. **Restart Persistence & Safety Net**:
   - Redis is configured in `docker-compose.yml` with `--appendonly yes` (AOF persistence).
   - On server or worker boot, a **Reconciliation Step** (`ReconciliationService.reconcilePendingJobs()`) scans PostgreSQL for any `PENDING` jobs missing from BullMQ and re-enqueues them with `delay = max(0, scheduledTime - now)`.

---

## 📁 Monorepo Structure

```
reachinbox-scheduler/
├── docker-compose.yml       # Root: persistent Postgres + Redis services
├── load-test.ts             # Bulk 1,000+ email scheduling demonstration script
├── README.md
├── backend/
│   ├── src/
│   │   ├── config/          # Environment loader & system constants
│   │   ├── db/              # Prisma Client singleton
│   │   ├── queues/          # BullMQ queue & worker definitions
│   │   ├── services/        # Scheduling, Rate Limiter, Ethereal SMTP, Reconciliation
│   │   ├── controllers/     # Auth, Email, Sender controllers
│   │   ├── routes/          # Express router modules
│   │   ├── middleware/      # JWT auth guard, error handling, Zod validation
│   │   ├── server.ts        # Express API Server entrypoint
│   │   └── worker.ts        # Standalone BullMQ Worker process entrypoint
│   ├── prisma/
│   │   └── schema.prisma    # PostgreSQL Schema (User, Sender, Campaign, EmailJob)
│   ├── Dockerfile
│   └── package.json
└── frontend/
    ├── app/
    │   ├── login/           # Sign in with Google / Quick Demo login
    │   ├── dashboard/       # Dashboard Shell with Navigation Tabs
    │   │   ├── page.tsx     # Scheduled Emails Table View
    │   │   └── sent/        # Sent Emails Table View
    │   └── components/
    │       ├── ui/          # Custom primitives: Button, Input, Table, Modal, Badge, Toast
    │       ├── Header.tsx
    │       ├── ComposeModal.tsx
    │       ├── ScheduledTable.tsx
    │       └── SentTable.tsx
    ├── lib/
    │   └── api.ts           # Typed API Client
    ├── types/
    │   └── index.ts         # Shared TypeScript interfaces
    └── package.json
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Docker & Docker Compose
- Node.js v18+ & npm

### Option A: One-Command Monorepo Launch (Recommended)
```bash
# In repo root (d:/outbox)
docker-compose up -d
npm run dev
```
*This starts the API server, BullMQ worker, and Next.js frontend concurrently in a single terminal!*

### Option B: Individual Service Launch
```bash
# Terminal 1: Backend API
cd backend && npm run dev

# Terminal 2: Standalone BullMQ Worker
cd backend && npm run dev:worker

# Terminal 3: Next.js Frontend
cd frontend && npm run dev
```

---

## 📧 Setting Up Ethereal SMTP Accounts

The backend automatically bootstraps a working Ethereal Email test account on first launch if no senders exist in the database!

To add custom Ethereal credentials manually to `.env` or create additional senders:
1. Visit [https://ethereal.email/create](https://ethereal.email/create)
2. Copy the generated Username and Password.
3. Post to `/api/senders` or let the backend generate additional test profiles automatically via the dashboard header.

---

## 🧪 Bulk Load Test (1,000+ Jobs Simulation)

To demonstrate how the system handles bursts of 1,000+ jobs without crashing, double sending, or violating rate limits:

```bash
# From root directory
npx ts-node load-test.ts
```

**Expected Load Test Output**:
- Generates 1,000 lead email jobs.
- Hashes idempotency keys for each lead.
- Distributes jobs across sliding hour windows respecting `maxEmailsPerHour`.
- Verifies re-run idempotency protection (0 duplicates created).

---

## ✅ Spec Checklist

### Backend Requirements
- [x] **No Cron**: 100% BullMQ delayed jobs (`grep -ri cron` returns no scheduler crons).
- [x] **PostgreSQL & Prisma**: Complete schema with `User`, `Sender`, `Campaign`, and `EmailJob`.
- [x] **Ethereal SMTP Integration**: Real sending via Nodemailer with inbox preview links saved to DB.
- [x] **Google OAuth 2.0 & JWT Session**: `passport-google-oauth20` integration + quick demo fallback login.
- [x] **Worker Concurrency**: Configurable via `WORKER_CONCURRENCY=5`.
- [x] **Rate Limiting**: Redis `sender:{id}:hour:{YYYY-MM-DDTHH}` counter auto-rescheduling jobs to future windows.
- [x] **Inter-Send Delay**: Minimum delay (2000ms per sender) stored in Redis `lastSentAt`.
- [x] **Idempotency Guard**: Unique SHA-256 idempotency key prevents duplicate sends on retries/crashes.
- [x] **Startup Reconciliation**: Scans PostgreSQL on boot for `PENDING` jobs missing from BullMQ and re-enqueues them with remaining delay.

### Frontend Requirements
- [x] **Next.js App Router & TypeScript**: Pure Next.js App Router codebase.
- [x] **Tailwind CSS Design System**: Custom reusable UI primitives (`Button`, `Input`, `Table`, `Modal`, `Badge`, `Toast`).
- [x] **Login Page**: Sign in with Google + Demo Login button.
- [x] **Dashboard Shell**: Top header with avatar, name, email, sender selector, logout.
- [x] **Compose Campaign Modal**: Subject, body, drag-and-drop CSV recipient parsing, start time, rate limit tuning.
- [x] **Scheduled Emails Table**: Loading skeleton, empty state, status badges, pagination.
- [x] **Sent Emails Table**: Sent time, status, Ethereal preview link, error details, pagination.

---

## 📝 Assumptions & Trade-offs

1. **Ethereal SMTP Sandbox**: Used as the fake SMTP provider per the spec. Sent emails return real HTML preview URLs accessible via the dashboard table.
2. **Redis AOF Persistence vs Reconciliation**: Redis is configured with `appendonly yes` for crash durability. The startup reconciliation service provides a secondary safety net in case Redis memory is flushed or wiped.
3. **Google OAuth Config**: If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not set in `.env`, the login page provides a "Launch Quick Demo Session" button so code evaluators can test the entire full-stack application immediately without registering Google Cloud API credentials.
