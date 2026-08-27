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
| Profile avatar | One shared user-supplied Faro cat image | Rendered consistently for every Faro member; there is no avatar picker or user-image upload |
| Signal analysis | Existing deterministic buyer-intent rules | Independent; no active Manus model dependency |
| Collection | Client-initiated fresh-first batches, capped at three provider pages | Automatic worker disabled in staging; every provider call remains explicit and bounded |

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
| Profile avatar | One shared user-supplied cat image is served from managed static storage; profile completion accepts no avatar input and personal-photo upload remains absent |

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
4. Let Vercel create a deployment. Its build command runs `pnpm db:migrate && pnpm build:serverless && pnpm build:client`; the first successful build applies the initial Neon schema and creates the serverless function bundle.
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
| Object storage | Deferred; personal-photo upload remains hidden until client-owned storage is selected and tested. The single shared static cat image requires no per-user storage. |

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
| Offline Vitest suite | Passed: 38 files and 142 tests with the two legacy live credential smoke tests explicitly excluded; those tests now require `RUN_LIVE_PROVIDER_CREDENTIAL_TESTS=1` before they can contact a provider |
| Managed Manus OAuth in active router | Removed; local passkey router is active |
| Active Manus model dependency | Removed; deterministic buyer-intent logic is active |
| Provider collection during current release validation | None made; legacy credential smoke checks require an explicit opt-in flag |
| Manus production fallback | Unchanged |

## Current Deployment State

The isolated `vercel-neon-staging` branch is published to `ana-momin/Faro`; the current combined core-release commit is `0bb41bb`. The canonical address is reachable without a Vercel sign-in wall and correctly serves the application onboarding shell and health function. Visual verification confirms both visible Faro AI logo placements load the original mascot from `/faro-mascot.png`.

The canonical `auth.passkeyRegistrationOptions` endpoint was rechecked after the core release and returned `200` JSON with relying-party ID `faro-ai-staging.vercel.app`, `residentKey: "preferred"`, and `userVerification: "preferred"`. The remaining manual acceptance check is one device-local passkey enrollment and re-login on the canonical address. No provider credential, provider collection, DNS change, GitHub `main` change, or Manus cutover is included in that check.

## Responsive Onboarding Verification

The passkey onboarding shell is constrained to the dynamic viewport with no outer-page scroll. Visual checks at `1280×720` and `375×812` confirm that the desktop composition remains fully visible and the mobile composition collapses to a single, comfortably spaced panel without clipping its title or actions. On unusually short screens, only the right-pane form content can scroll, preserving access to every input without allowing the page itself to overflow.

## Passkey Route Diagnosis

The active Vercel production deployment on `vercel-neon-staging` includes four Node.js functions, including `/api/trpc/[...path]`. The deployed `POST /api/trpc/auth.passkeyAuthenticationOptions` initially returned an empty `405` response from the static `index.html` fallback. After the route-precedence correction, the request reached the tRPC function and exposed the remaining runtime issue: Vercel could not resolve the shared application from a sibling source file (`ERR_MODULE_NOT_FOUND: /var/task/server/app.ts`). The build now runs `pnpm build:serverless`, which bundles `server/app.ts` into `api/_faroApp.mjs`; every function imports that generated local artifact, and Vercel explicitly includes it in the function package. The generated artifact is intentionally ignored by Git because the Vercel build creates it before function packaging. Local bundle creation, TypeScript, focused passkey regressions, and the production client build all pass. The Vercel runtime log and resources page confirm this diagnosis; deployment `c765553` was Ready with all four functions present, and commit `2508648` exposed the source-module limitation. No provider dependency is involved.

The repaired deployment was rechecked directly. `POST /api/trpc/auth.passkeyAuthenticationOptions?batch=1` now returns `200 application/json` with a WebAuthn challenge and `rpId` of `faro-ai-staging.vercel.app`, rather than an empty response or function failure. This confirms that the browser no longer encounters the `Unexpected end of JSON input` parsing failure at the first passkey step.

The canonical staging page now visibly presents two clear entry points: **Create a new passkey** and **I already have a passkey**. A mobile `375×812` check confirms the initial screen remains a compact, non-scrolling single panel with both actions fully visible. The full offline validation passed with **39 test files and 134 tests**, alongside the Vercel server-bundle build, TypeScript check, and Vite production client build. No X-provider operation was run.

## Passkey Error and Profile Completion Refinement

Raw browser and WebAuthn specification messages are no longer shown to a Faro user. The onboarding client maps cancellation, timeout, unsupported-device, security, already-existing-passkey, and generic confirmation failures to concise, professional guidance. Known product-safe server messages remain readable; unrecognized technical messages never reach the screen.

After a new passkey is confirmed, Faro now shows a dedicated **Complete your profile** screen. It keeps the original warm, minimal onboarding composition, requires a name, and accepts an optional email. No profile image appears in onboarding, and there is no avatar selection, personal-photo upload, or avatar value in the protected profile-completion contract. Once signed in, every Faro member surface uses the same user-supplied cat image, served by the Vercel build from `/faro-profile-cat.png`. No schema migration, object storage, personal image bytes, or X-provider operation is required.

The Production `CREDENTIAL_ENCRYPTION_SECRET` was replaced in Vercel with a fresh high-entropy Secret after the provider-settings form reported that its prior value was unavailable or too short. The value was generated and stored only inside Vercel, is not present in source or documentation, and requires a redeployment before the function runtime uses it. The focused offline encryption regression covers the 32-character minimum and AES-256-GCM round trip without making any provider request.

The focused shared-profile and passkey regression suite now confirms that the onboarding screen has no avatar picker, every member surface uses the same managed image, and the protected profile mutation accepts only name and optional email. Desktop `1280×720` and mobile `375×812` visual checks remain part of the release validation.

For this shared-image release, the unsigned passkey welcome screen was rechecked at `1280×720` and `375×812`. Both layouts preserve the original Faro logo, clear dual passkey actions, and a non-scrolling outer page. The required post-passkey profile screen is covered by source-level visual contracts because passkey enrollment is intentionally left to the client’s device during staging validation.

## Passkey Compatibility Update

The pending staging release requests **preferred** resident-key and user-verification behavior during registration and authentication rather than requiring a particular authenticator capability. The two-step onboarding explains that a user may choose Windows Hello, Google Password Manager, a phone, or another method offered by their browser. Server verification remains bound to the canonical HTTPS origin and relying-party ID, but does not reject a compatible credential solely because it did not provide user verification. A real credential is never created during automated validation; one user-run Windows/Google Password Manager check remains required after deployment.

## Fresh Collection and Feed Behavior

Client-run Search and Feed refreshes now start from the provider’s newest available posts rather than resuming a stale continuation cursor. A manual refresh checks up to **three** fresh pages—one per buyer-intent query family—subject to the client’s existing daily request limit. The Feed shows the **current active search** newest-first, while older searches remain available only through Search history. Exact X post IDs and conservative near-duplicate wording are suppressed; a provider row already present in storage is refreshed for accuracy but is not reported as a new post. This avoids presenting stored historical rows as a new real-time batch without adding an automatic worker or making any unapproved provider call during deployment verification.

## Search History and Daily Budget Guard

Saved searches now live directly inside the **Search** workspace. The in-page history column reopens each original stored result set without consuming a provider call. Submitting the same normalized brief reopens that saved result set instead of creating a duplicate monitor or spending another source call. Settings contains only **Provider** and **Saved**; the retired `/monitors` path redirects into Search.

The client and server both check the configured provider-call ledger before creating a search or refreshing a monitor. When the daily limit is exhausted, Faro does not create a new monitor or contact an X provider; it shows a clear message that identifies the configured limit and points the client to **Settings → Provider** to increase it or wait for the next daily window. This check preserves the existing multi-page cap and does not make a provider request during release validation.

## Provider Editing and Search Continuation

A saved provider connection now separates its two controls. **Save limit** changes the daily source-call allowance without rendering, requesting, or replacing the encrypted credential. **Replace key** is a deliberate separate panel, and the new credential is only accepted there. Global success notices use the Faro green treatment; failures use the Faro red treatment.

Search renders up to ten qualified, recent saved requests initially when the live inventory supplies them. Its local **Time** control can show all saved matches, the last 24 hours, last 7 days, or last 30 days without another source call. If that result set already contains more stored rows, **Show 10 more** expands it locally and does not call a provider. When stored rows are exhausted, **Load more recent matches** is exposed only when at least one persisted query-family cursor is available and the configured daily budget has remaining capacity. A manual continuation is allowed for a paused saved search without re-enabling background collection; it resumes cursor-bearing family pages only, updates those cursors after collection, and suppresses exact duplicate post IDs across the collection cycle. Collection success counts now include only newly saved, visible high-confidence buyer requests, rather than lower-intent candidates that the Search UI would filter out. Faro cannot promise ten qualifying requests for every brief because the live provider inventory and buyer-intent qualification determine the final yield.

## References

[1]: https://vercel.com/docs/environment-variables "Vercel: Environment variables"

[2]: https://vercel.com/docs/plans/hobby "Vercel: Hobby plan"

[3]: https://neon.com/docs/introduction/plans "Neon: Plans"

[4]: https://vercel.com/docs/functions/limitations "Vercel: Function limits"

[5]: https://vercel.com/kb/guide/how-do-i-change-the-name-of-my-vercel-project "Vercel: Change a project name"
