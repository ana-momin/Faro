<p align="center">
  <img src="client/public/faro-mascot.png" width="96" height="96" alt="Faro AI mascot" />
</p>

<h1 align="center">Faro AI</h1>

<p align="center"><strong>Human-led social listening for buyer-side service requests on X.</strong></p>

<p align="center">
  <a href="https://faro-ai-staging.vercel.app/"><strong>Live app</strong></a> ·
  <a href="#client-workflow">Workflow</a> ·
  <a href="#client-provider-setup">Provider setup</a> ·
  <a href="#project-documentation">Documentation</a> ·
  <a href="#development">Development</a> ·
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-6b4f3f">
  <img alt="Stack" src="https://img.shields.io/badge/stack-React%20%C2%B7%20tRPC%20%C2%B7%20Postgres-6b4f3f">
</p>

Faro AI monitors public X (Twitter) posts in real time and surfaces the ones written by people who are actively **asking for help** — a founder who needs an AI agent built, a team that needs workflow automation, a business looking for testing, development, content, or video support. Instead of scrolling X manually, a client types a plain-language brief and Faro returns a short, reviewable list of genuine buyer requests.

It is built to find **demand**, not noise: service offers, job postings, promotions, networking, and generic AI chatter are filtered out.

> **Human-control boundary.** Faro never sends messages, replies, follows, likes, or posts on X. It indexes and ranks public posts for a person to review; every outreach decision stays manual.

## Project documentation

| Doc | What it covers |
| --- | --- |
| [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) | The current architecture, product rules, and safe working sequence — read this first before making a code, deployment, credential, or database change. |
| [`docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md) | A short, non-technical explanation of the product, client journey, and cost model. |
| [`docs/VERCEL_NEON_STAGING.md`](./docs/VERCEL_NEON_STAGING.md) | The Vercel + Neon deployment runbook: environment variables, build pipeline, and verification record. |
| [`docs/PROVIDER_REFERENCE.md`](./docs/PROVIDER_REFERENCE.md) | TwitterAPI.io and Official X API endpoint contracts and pricing links. |
| [`docs/SUBMISSION_DEMO.md`](./docs/SUBMISSION_DEMO.md) | A guided walkthrough of the product for a first-time reviewer. |

## Client workflow

| Step | What happens | Provider usage |
| --- | --- | --- |
| **Sign in** | A device passkey (Windows Hello, Google Password Manager, phone, etc.) creates a private workspace. No password to manage. | — |
| **Provider** | The client connects their own TwitterAPI.io key or Official X API bearer token in **Settings → Provider**. | No request is made when saving a key. |
| **Search** | The client writes a plain-language buyer-intent brief, or picks a ready-made suggestion. An LLM turns it into search terms; Faro collects one bounded fresh batch and ranks buyer-side candidates. | **At most one provider request.** |
| **Feed** | Faro shows up to ten qualified requests, with earlier qualified posts kept for review. | No provider request. |
| **Load more** | The client deliberately continues the next cursor/query-family batch. | **At most one provider request.** |
| **Review** | The client opens full X-post context, saves a private bookmark or note, and keeps or dismisses the signal. | No provider request, no external action. |

Automatic background collection is **off by default**. Each client has an adjustable daily request limit tracked independently of other accounts, and entering the exact same brief twice reopens the saved result set instead of spending another provider call.

## Client provider setup

Faro stores exactly one active provider connection per account. The credential is encrypted with AES-256-GCM before it touches the database, and the browser only ever receives a masked final-four-character hint after setup — never the credential itself.

| Provider | When to use it | Links |
| --- | --- | --- |
| **TwitterAPI.io** | A third-party X data provider using its own account, credits, and advanced-search endpoint. | [Pricing](https://twitterapi.io/pricing) · [Dashboard](https://twitterapi.io/dashboard) · [API docs](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search) |
| **Official X API** | The direct X developer platform with the client's own bearer token and account entitlements. | [Pricing](https://docs.x.com/x-api/getting-started/pricing) · [Developer Console](https://developer.x.com/) |

Provider rates, limits, and entitlements are controlled by the provider and can change, so Faro never promises a fixed cash cost — only its own deterministic guardrail: **one provider request per client-initiated collection batch**.

## Core capabilities

| Area | Capability |
| --- | --- |
| **Natural-language search** | A brief like *"founders looking for a provider to build AI agents"* is turned into search terms and an X query by an LLM, with an automatic deterministic fallback if no LLM key is configured. See [`server/monitoring/ai.ts`](./server/monitoring/ai.ts). |
| **Buyer-only ranking** | LLM-assisted per-post intent classification plus a deterministic scoring layer: request-intent signals, delivery-scope evidence, personalized preference boosts, duplicate grouping, and promotional/noise suppression. See [`server/monitoring/ranking.ts`](./server/monitoring/ranking.ts). |
| **Social feed** | Full X-style cards — author, category, confidence, why-it-matched evidence, a direct X link — with compact keep/dismiss controls and private saved posts. |
| **Search workspace** | A centered, LLM-style command bar with full-line suggestion prompts, in-progress status, and up to ten qualified results per run. |
| **Saved-search manager** | Rename, pause/resume, or delete saved searches without spending a provider call. |
| **Client credit protection** | Encrypted client-owned provider credentials, strict per-batch page caps, a client-scoped daily request allowance, and no background collection by default. |
| **Passkey authentication** | Passwordless sign-in via SimpleWebAuthn, backed by a signed, httpOnly session cookie. |

## Architecture

```text
client/     React 19 + Vite + Tailwind interface
server/     Express + tRPC API, collection policy, intent/ranking, encrypted provider settings
drizzle/    PostgreSQL schema (renderSchema.ts) and ordered Neon migrations
docs/       Product, deployment, and provider-API reference documentation
shared/     Types and constants shared between client and server
```

React 19, TypeScript, Vite, and Tailwind CSS on the frontend; Express and tRPC on the backend; Drizzle ORM against Neon PostgreSQL for storage. Provider calls and LLM calls are both server-side only — no provider credential or LLM key is ever exposed to the browser.

## Development

### Requirements

- Node.js 22 or later
- pnpm 10 or later
- A PostgreSQL database (Neon works out of the box; any Postgres instance is fine for local dev)

### Install and run

```bash
pnpm install
pnpm dev
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Yes | PostgreSQL connection strings. |
| `SESSION_SECRET` | Yes | Signs the device-passkey session cookie (32+ characters). |
| `CREDENTIAL_ENCRYPTION_SECRET` | Yes | AES-256-GCM key for encrypting client provider credentials (32+ characters, different from `SESSION_SECRET`). |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Optional | Base URL and key for an OpenAI-chat-completions-compatible LLM endpoint (e.g. Groq). Without it, Faro automatically falls back to its deterministic rule-based query and ranking logic — the app never fails without it. |
| `FARO_LLM_MODEL` | Optional | Overrides the default LLM model id (`qwen/qwen3.8-27b`). |
| `PASSKEY_RP_ID` / `PASSKEY_ORIGIN` | Optional | Pins the passkey relying-party ID/origin; otherwise derived from the request. |

### Database migrations

```bash
# Generate a migration after changing drizzle/renderSchema.ts
pnpm drizzle-kit generate

# Apply migrations to the configured database
pnpm drizzle-kit migrate
```

The schema includes `provider_connections`, which stores an encrypted client-owned credential and its request-limit preference. Never insert a plaintext provider key directly into this table.

### Quality checks

```bash
pnpm check
pnpm vitest run --exclude server/twitterApiIo.credentials.test.ts --exclude server/xApi.credentials.test.ts
pnpm build
```

The two excluded tests are live-credential smoke tests that contact a real provider account; they're gated behind `RUN_LIVE_PROVIDER_CREDENTIAL_TESTS=1` and should only run as a deliberate, client-authorized check.

## Deployment

Faro runs on **Vercel Functions + Neon PostgreSQL**, deployed from the `main` branch. The build pipeline runs the database migration, then bundles the serverless function and the client:

```bash
pnpm db:migrate && pnpm build:serverless && pnpm build:client
```

`api/*.ts` are the serverless entry points; they import a generated `api/_faroApp.mjs` bundle (built from `server/app.ts`, git-ignored, produced fresh on every deploy). The canonical health check is `GET /healthz`.

See [`docs/VERCEL_NEON_STAGING.md`](./docs/VERCEL_NEON_STAGING.md) for the full environment-variable table, verification record, and rollout history.

## Security and privacy

- Provider credentials and LLM keys are read only from server-side environment configuration and are never sent to the browser.
- Client provider credentials are encrypted at rest with AES-256-GCM; the UI only ever sees a masked hint after saving.
- Provider and LLM calls are client-scoped, deliberately bounded, and never made during normal page rendering — only in direct response to a user action.
- Public X posts are treated as signals; a human reviewer makes every outreach decision.
- Keep `DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENCRYPTION_SECRET`, `BUILT_IN_FORGE_API_KEY`, and provider keys in your host's secret manager. Never commit them — `.env*` is git-ignored.

## Repository hygiene

The repository excludes dependency folders, build output, local environment files, logs, and generated artifacts. Before opening a pull request, run the quality checks above and review any database migration by hand.

## License

Released under the [MIT License](./LICENSE).
