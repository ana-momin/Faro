# Faro AI Vercel + Neon Staging Operations

**Status:** Independent **Vercel + Neon staging** migration in progress. This document supersedes the earlier Render attempt after its free database provisioning returned `402 Payment Required`. It does not authorize DNS changes, production cutover, client-data import, or an X-provider request. The published Manus application remains the rollback fallback.

## Purpose and Boundary

Faro AI is being separated from Manus-managed OAuth, database access, runtime helpers, and storage routing. The staging target is the client-owned Vercel project [`Faro`](https://vercel.com/alpha-ea14/faro), connected to the client-owned Neon Free PostgreSQL project. The migration is intentionally conservative: provider collection stays manual and disabled by default, existing provider credentials are **not** migrated, and the existing Manus deployment remains available.

> **Staging rule:** No TwitterAPI.io or Official X API request is part of setup, schema migration, deployment, onboarding, or smoke testing. A client must reconnect a provider key after independent launch and explicitly approve any bounded source request.

| Area | Independent staging implementation | Current position |
|---|---|---|
| Hosting | Vercel Function with a Vite static build | Deployed from `vercel-neon-staging`; application shell and `/healthz` are reachable |
| Database | Neon Free PostgreSQL through `DATABASE_URL_UNPOOLED` | Neon integration connected; initial schema migration is committed |
| Authentication | Local device passkey via SimpleWebAuthn and signed httpOnly session cookie | Implemented; name required and email optional |
| Provider credentials | Server-side AES-256-GCM, keyed by `CREDENTIAL_ENCRYPTION_SECRET` | Implemented; no old ciphertext is copied |
| Profile photo | Initials/fallback avatar only | Deferred until independent object storage is chosen |
| Signal analysis | Existing deterministic buyer-intent rules | Independent; no active Manus model dependency |
| Collection | Manual one-request batches only | Automatic worker disabled in staging |

## Runtime Design

The application keeps the existing React, Express, and tRPC boundaries. `api/index.ts` exports the shared Express app without calling `listen()`. The app exposes `GET /healthz` and mounts tRPC under `/api/trpc`. Vercel routes `/api/*` to the function and serves the generated Vite application as the single-page frontend.

Passkey registration requires a non-empty name and accepts an optional email. A verified device passkey creates a Faro user and a signed `faro_device_session` cookie. The relying-party host and origin are derived from the request unless a later permanent domain explicitly sets `PASSKEY_RP_ID` and `PASSKEY_ORIGIN`. This keeps preview and staging URLs testable without committing an origin.

| Security control | Required behavior |
|---|---|
| `SESSION_SECRET` | At least 32 characters; signs device-local session tokens and remains a Vercel Secret |
| `CREDENTIAL_ENCRYPTION_SECRET` | Separate value of at least 32 characters; encrypts each client-owned X-provider key at rest |
| Database values | Supplied by the Neon integration; never committed or copied into source files |
| Provider keys | Reconnected by each client after independent launch; masked in the UI and never returned to the browser as plaintext |
| Browser/server transport | Browser uses tRPC only; the server remains the only code that can decrypt a provider credential or call an X provider |
| Profile image | Upload control is intentionally absent while object storage is unconfigured, preventing a dead or misleading action |

## Vercel Environment Configuration

Vercel environment variables are encrypted at rest and apply only to **new** deployments after they are changed. Preview variables apply to non-production Git branches; Production variables apply to the configured production branch. [1]

| Variable | Scope for current staging release | Source | Notes |
|---|---|---|---|
| `DATABASE_URL` | Production and Preview | Neon integration | Retained for runtime compatibility |
| `DATABASE_URL_UNPOOLED` | Production and Preview | Neon integration | Used by Drizzle migration command |
| `SESSION_SECRET` | Production; add to Preview before branch-preview auth testing | Client-managed Vercel Secret | Separate, high-entropy secret |
| `CREDENTIAL_ENCRYPTION_SECRET` | Production; add to Preview before branch-preview provider setup testing | Client-managed Vercel Secret | Must differ from `SESSION_SECRET` |
| `PASSKEY_RP_ID` | Unset initially | N/A | Derived safely from the deployed host |
| `PASSKEY_ORIGIN` | Unset initially | N/A | Derived safely from the request origin |
| X-provider credentials | Not configured during migration validation | Client reconnects later | Avoids credit consumption and credential transfer |

The Neon integration has already injected its PostgreSQL connection variables into Production and Preview. Session and credential-encryption secrets must never be placed in Git, browser-visible `VITE_*` variables, logs, tickets, or documentation.

## Deployment Workflow

The independent work is isolated on Git branch `vercel-neon-staging`. GitHub `main` remains the current safe Manus-compatible baseline until the staging application has passed deployment verification. No DNS or custom-domain changes are permitted during this workflow.

1. Run the offline validation suite, TypeScript check, and client build locally.
2. Review the PostgreSQL migration files under `drizzle/render/`, including the journal and snapshot metadata.
3. Commit and push only `vercel-neon-staging` to the connected `ana-momin/Faro` repository.
4. Let Vercel create a deployment. Its build command runs `pnpm db:migrate && pnpm build:client`; the first successful build applies the initial Neon schema.
5. Inspect build and function logs. Resolve build, migration, route, or environment failures before attempting onboarding.
6. Verify `GET /healthz`, the static app shell, tRPC `auth.me`, and the passkey onboarding UI over HTTPS.
7. Create one staging passkey, confirm it lands in Feed, sign out, and sign in on the same device. Do not configure an X provider or run Search/Refresh.
8. Retain Manus as fallback and keep `main` unchanged until explicit client approval of a separate production cutover.

## Free-Tier Limitations

This deployment is a functional staging environment, not a production promise. Vercel documents Hobby as free for personal and small-scale use, and its fair-use guidance restricts Hobby to non-commercial personal use; Vercel also applies per-month usage limits. [2] Neon documents Free for prototypes, side projects, and small teams with 100 CU-hours, 0.5 GB storage, a five-minute scale-to-zero behavior, a six-hour history window, and one manual snapshot per project. [3]

| Service | Practical implication for Faro AI |
|---|---|
| Vercel Hobby | Suitable to validate the migration and pilot mechanics, but not a durable paid-client production commitment under its current plan terms. |
| Vercel Function | Stateless and request-scoped; it cannot be treated as a permanent stream worker. The code therefore leaves automatic collection disabled. Vercel documents a five-minute Hobby Function duration limit. [4] |
| Neon Free | Database cold starts after inactivity are expected because scale-to-zero cannot be disabled on Free. [3] |
| Neon Free recovery | The six-hour history window and one manual snapshot are insufficient as a sole production backup policy. [3] |
| Object storage | Deferred; profile-photo upload remains hidden until client-owned storage is selected and tested. |

## Canonical Vercel Staging Address

The canonical Faro AI staging address is **https://faro-ai-staging.vercel.app**. It is short, memorable, and already serves the independent passkey onboarding experience with the approved Faro mascot branding. The long branch-preview address is not the address to share.

Direct staging verification confirms that the canonical root returns the Faro AI passkey onboarding page and `GET /healthz` returns `{"ok":true,"service":"faro-ai"}`. This proves the Vite application shell and Vercel health function are routed correctly. Passkey enrollment and re-login remain a separate user-interaction check; no provider credential or collection request is part of this validation.

## Data, Credential, and Cutover Policy

No Manus database dump or credential migration occurs by default. New passkey accounts create independent identities in Neon. Existing monitors, post history, saved posts, hidden posts, and notes can be migrated only after explicit approval, a recoverable source backup, a written row-count reconciliation plan, and a user-mapping review.

> **Credential policy:** Do not migrate Manus ciphertext by default. It may be bound to a different encryption secret and requires a controlled re-encryption path. Each client reconnects their own provider credential in the new application after launch.

No production traffic moves until all of the following are true: the deployed staging checks pass, the client accepts the independently hosted behavior, a durable hosting and backup plan is selected, data migration (if any) is reconciled, clients have reconnected their own provider keys, and the client explicitly approves a DNS or domain cutover. If any problem appears before a cutover, traffic remains on Manus and the independent branch is repaired in staging.

## Verification Record

| Check | Result before deployment |
|---|---|
| TypeScript | Passed on the independent migration branch |
| Client production build | Passed on the independent migration branch |
| Offline Vitest suite | Passed: 33 files and 128 tests; independent branding regression also passed after the original mascot restoration |
| Managed Manus OAuth in active router | Removed; local passkey router is active |
| Active Manus model dependency | Removed; deterministic buyer-intent logic is active |
| Provider request during migration validation | None made |
| Manus production fallback | Unchanged |

## Current Deployment State

The isolated `vercel-neon-staging` branch is published to `ana-momin/Faro`; the latest original-branding repair is commit `4a53b84`. The canonical address is reachable without a Vercel sign-in wall and correctly serves the application onboarding shell and health function. Visual verification confirms both visible Faro AI logo placements load the original mascot from `/faro-mascot.png`.

The remaining manual check is one device-local passkey enrollment and re-login on the canonical address. No provider credential, provider collection, DNS change, GitHub `main` change, or Manus cutover is included in that check.

## Responsive Onboarding Verification

The passkey onboarding shell is constrained to the dynamic viewport with no outer-page scroll. Visual checks at `1280×720` and `375×812` confirm that the desktop composition remains fully visible and the mobile composition collapses to a single, comfortably spaced panel without clipping its title or actions. On unusually short screens, only the right-pane form content can scroll, preserving access to every input without allowing the page itself to overflow.

## References

[1]: https://vercel.com/docs/environment-variables "Vercel: Environment variables"

[2]: https://vercel.com/docs/plans/hobby "Vercel: Hobby plan"

[3]: https://neon.com/docs/introduction/plans "Neon: Plans"

[4]: https://vercel.com/docs/functions/limitations "Vercel: Function limits"

[5]: https://vercel.com/kb/guide/how-do-i-change-the-name-of-my-vercel-project "Vercel: Change a project name"
