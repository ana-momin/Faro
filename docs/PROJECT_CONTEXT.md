# Faro AI Project Context and Continuation Guide

> **Use this file first whenever continuing, debugging, or extending Faro AI.** It describes the current independent staging deployment, the non-negotiable product rules, and the safest working sequence.

## Current Project Position

Faro AI is a private, client-oriented social-listening web application. It finds public X posts from people seeking someone to deliver work—such as AI agents, automation, workflows, software development, product testing, content, or video work—and presents those requests for human review. It does not send messages or take actions on X.

| Item | Current value |
| --- | --- |
| **Canonical staging app** | [https://tryfaro.vercel.app/](https://tryfaro.vercel.app/) |
| **GitHub repository** | `ana-momin/Faro` |
| **Active deployment branch** | `vercel-neon-staging` |
| **Protected fallback branch** | `main` — do not modify or merge into it without an explicit request |
| **Hosting and database** | Vercel Functions + Neon PostgreSQL |
| **Authentication** | Device passkeys through SimpleWebAuthn, with a signed `faro_device_session` cookie |
| **Provider collection** | Manual, client-initiated, server-side only; automatic collection is disabled |

The detailed operational record is in [`VERCEL_NEON_STAGING.md`](./VERCEL_NEON_STAGING.md). The latest code must always be inspected rather than inferred from this file; this document records the working model, not a replacement for the source of truth.

## Product Rules That Must Not Change Accidentally

Faro is a **buyer-request discovery tool**. A useful match is a person or team asking for a provider, freelancer, expert, agency, developer, or team to do real work. A post offering a service, advertising, hiring for an employment role, seeking a job, sharing a course, or discussing a topic generally is not a Faro result.

The app must preserve the following boundaries. Provider credentials are entered by each client and encrypted on the server; they must never be returned to the browser, committed to Git, written to logs, or shown in documentation. Provider calls remain server-side. No personal X cookies, scraping session, automated messages, replies, posts, follows, likes, or outreach are permitted. A new live provider collection must be explicitly user-approved and bounded before it is run.

## Core Search Contract

Search is the product’s central workflow. A client types a short buyer-service brief, such as “Find founders looking for a provider to implement AI agents.” Faro creates a saved search once, requests a bounded fresh batch, ranks buyer-side candidates, stores qualified results, and displays up to ten. Entering the exact same normalized brief reopens the saved result set rather than spending another provider call.

| Stage | Required behavior | Provider effect |
| --- | --- | --- |
| **New Search** | Starts current query families from newest available public posts; screens for buyer-side demand. | Bounded by the collection policy and client daily allowance. |
| **Saved Search** | Reopens prior qualified posts without collection. | No provider request. |
| **Time filter** | Shows saved results from last 24 hours, 7 days, 30 days, or all saved results. | No provider request. |
| **Show 10 more** | Reveals already saved results in manageable local groups. | No provider request. |
| **Load more recent matches** | Continues only a stored cursor for the same search when a cursor and daily allowance exist. | One bounded, explicit continuation. |
| **Refresh** | Starts from new source posts, not a stale continuation token. | Explicit, bounded collection. |

The current app uses three buyer-intent query families—direct demand, task help, and recommendation—to widen discovery without unbounded searching. Each client-initiated fresh batch is capped at three provider pages, and new provider configurations default to **10 source calls per day**. Existing saved daily limits are retained unless a client edits them in **Settings → Provider**.

Exact X post IDs are suppressed across a user’s saved searches. Active Search results keep their own qualified results visible, even when an older search already owns the same source post. Continuation is offered only for a cursor-bearing stored query state; it must never rerun the first source page just to appear to load more.

## Key Code Map

| Area | Main files | Change with care because… |
| --- | --- | --- |
| **Search interface** | `client/src/pages/Search.tsx` | It owns active result-set selection, time filtering, local paging, progress, and continuation actions. |
| **Feed** | `client/src/pages/Home.tsx`, `client/src/lib/discoverFeed.ts` | It presents current-search results and client-side visible ordering/deduplication. |
| **Provider settings** | `client/src/pages/ProfileProviderSetup.tsx` | Daily-limit edits must never expose or require the saved credential. |
| **Search API** | `server/routers/monitoring.ts` | It enforces user ownership, daily budget, saved-brief reuse, and continuation access. |
| **Collection engine** | `server/monitoring/sync.ts` | It controls fresh versus continuation cursor use, provider-page caps, persistence accounting, and duplicate protection. |
| **Provider adapters** | `server/monitoring/xClient.ts` | It normalizes TwitterAPI.io and Official X API responses. Do not place credentials in client code. |
| **Query breadth** | `server/monitoring/query.ts` | Query families must retain buyer-intent phrasing and source-query validation. |
| **Buyer qualification** | `server/monitoring/ranking.ts` | It is intentionally strict against service offers, employment, promotions, and generic discussion. |
| **Natural-language / LLM layer** | `server/monitoring/ai.ts` | Calls an OpenAI-compatible LLM (`BUILT_IN_FORGE_API_URL`/`_KEY`) for brief-to-query extraction and per-post intent classification, with an automatic deterministic fallback (`server/monitoring/query.ts` / `ranking.ts`) when no key is configured or a call fails. Never let an LLM-proposed exclude term into the hard-veto list without checking it can't match genuine buyer phrasing. |
| **Persistence** | `server/db.ts`, `drizzle/renderSchema.ts` | Monitor, cursor state, hidden-post, saved-post, and encrypted connection changes require a schema-first review. |
| **Passkeys** | `server/routers/localAuth.ts`, `client/src/pages/Onboarding.tsx` | The canonical RP ID and HTTPS origin must remain correct; do not create a user’s passkey during testing. |

## Safe Working Sequence

Start every technical change by confirming the repository state with `git status --short --branch`, then confirm the active branch is `vercel-neon-staging`. Add a specific unchecked item to `todo.md` before implementation. Read the affected source and existing tests before modifying code. Keep a change narrowly scoped, update or add Vitest coverage, run the safe validation suite, inspect the diff, then commit and push only `vercel-neon-staging`.

Routine validation must remain provider-collection-free:

```bash
pnpm vitest run --exclude server/twitterApiIo.credentials.test.ts --exclude server/xApi.credentials.test.ts
pnpm check
pnpm build:serverless
pnpm build:client
```

The two legacy provider credential smoke tests are additionally guarded by `RUN_LIVE_PROVIDER_CREDENTIAL_TESTS=1`. Never set that flag or trigger a provider Search/Refresh merely to check code. A live provider run requires an explicit user instruction, a stated page cap, and a report of the actual outcome. Do not use a personal X account session.

After a meaningful verified change, save a managed project checkpoint. The project is configured to publish automatically when a checkpoint is saved. If Git changes are needed for the external Vercel deployment, commit and push only the staging branch. Never commit generated `api/_faroApp.mjs`, local `.env` files, logs, or build artifacts.

## Deployment and Secrets

The Vercel build runs database migration and builds the serverless and client bundles. The serverless entry imports the generated local `api/_faroApp.mjs`; it is created during build and intentionally ignored by Git. The canonical staging health endpoint is `GET /healthz`.

| Secret or setting | Purpose | Handling rule |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon PostgreSQL runtime and migration access | Supplied through Vercel/Neon; never commit. |
| `SESSION_SECRET` | Signs the device session | Store only as a high-entropy Vercel secret. |
| `CREDENTIAL_ENCRYPTION_SECRET` | AES-256-GCM encryption of client provider credentials | Separate from session secret and at least 32 characters. |
| `PASSKEY_RP_ID` / `PASSKEY_ORIGIN` | Optional fixed canonical passkey settings | Leave correctly derived for staging unless a permanent domain is intentionally configured. |
| Client X provider credential | Authorizes that client’s collection | Enter only through the authenticated provider form; remain encrypted and masked. |

The current canonical passkey options support compatible Windows Hello, Google Password Manager, phone, and other available browser authenticators with preferred resident-key and user-verification behavior. A device passkey remains a user action; automated validation should inspect only safe option endpoints, not enroll a credential.

## Known Limits and Honest Product Language

Faro aims to show up to ten recent qualified requests when live X inventory contains them. It cannot honestly guarantee ten results for every brief because the source inventory, language used by posters, date range, provider response, and strict buyer-only qualification affect the final count. Never claim that an empty result means the provider is broken unless the source response actually failed.

TwitterAPI.io currently advertises $0.10 in signup credit, which is 10,000 credits at its documented 100,000-credit-per-dollar rate. Its pricing and promotions are controlled by the provider and can change. Faro links clients to the provider dashboard and pricing page rather than claiming a fixed provider cost. [1] [2]

The verified offline suite, typecheck, serverless build, and client build are strong safeguards, but they cannot replace a live end-to-end provider audit when no authenticated passkey session is available. Record that limitation clearly; do not bypass passkey authentication to access a client connection.

## Future Change Checklist

When extending Faro, preserve the following order: define the desired buyer-request behavior; update source-query and ranking contracts together; test positive buyer requests and negative service-offer/job/promo cases; verify stored-result visibility, duplicate behavior, and continuation; then publish only the staging branch. For database changes, change the schema first, generate and review a migration, apply the migration safely, and add regression coverage before deployment.

Before a true public production cutover, complete a user-run passkey enrollment/sign-in test, a client-approved bounded live Search audit, a backup/recovery decision beyond the Neon Free tier, and explicit domain/cutover approval. Until then, describe Faro as an independently hosted **staging** application.

## References

[1]: https://twitterapi.io/ "TwitterAPI.io homepage"

[2]: https://twitterapi.io/pricing "TwitterAPI.io pricing"
