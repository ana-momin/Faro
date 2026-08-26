# Faro AI Legacy Render Migration Plan — Superseded

**Status:** Historical record only. Render was abandoned for this migration after free PostgreSQL provisioning returned `402 Payment Required`. The active independent staging runbook is [`VERCEL_NEON_STAGING.md`](./VERCEL_NEON_STAGING.md). The published Manus version remains the production fallback until a separate cutover decision is approved.

## Executive Decision

Faro should move to **Render as a Node web service**, not to a Vercel serverless deployment. The existing product is a React/Vite frontend served by an Express/tRPC backend, with a MySQL-compatible data model and server-only encryption of client-owned X provider credentials. Render supports deploying a Node/Express service from a linked Git repository with explicit build and start commands, custom domains, TLS, and environment variables. [1] [3]

The migration is **not** a lift-and-shift. Faro currently relies on managed Manus OAuth, a Manus-managed MySQL-compatible database, Manus storage URLs, Forge APIs, and Manus scheduling support. The target is an independently owned Render stack with a replacement authentication provider, a managed MySQL-compatible database, object storage, Render secrets, and no automatic X collection at launch.

> **Launch safety rule:** Existing encrypted provider credentials will not be copied as opaque database data unless they can be re-encrypted safely in a controlled migration. The default migration path requires each client to reconnect their own provider key after the Render launch. This protects client-owned credentials and avoids treating an unreadable encrypted value as portable data.

## Current Faro Architecture Inventory

| Current capability | Current implementation | Render migration treatment |
|---|---|---|
| Web app and API | React/Vite bundled with Express and tRPC; `pnpm build` then `pnpm start` | Keep one Node web service. Adjust the server to bind directly to Render’s `PORT` on `0.0.0.0`. [3] |
| Authentication | Manus OAuth callback, managed user lookup, JWT session helper, protected tRPC procedures | Replace with Clerk or Supabase Auth. Preserve `protectedProcedure`/user isolation but change how `ctx.user` is populated. |
| Database | Drizzle ORM with MySQL-compatible schema; users, monitors, post history, saved posts, reviews, provider connections, and request ledger | Use MySQL 8 as a Render private service or an external managed MySQL provider. Apply all Drizzle migrations before import. Render documents a private MySQL service with a persistent disk; application-level `mysqldump` backups remain required. [4] |
| Client provider credentials | AES-256-GCM encrypted server-side; one isolated connection per client account | Preserve server-only encryption with a new, stable Render secret. Do not expose credentials to the browser or copy them without a re-encryption plan. Require reconnect by default. |
| Profile images / stored files | Manus Forge storage and `/manus-storage/*` URLs | Move new uploads to Cloudflare R2 or Amazon S3. Migrate existing profile images separately, then update stored URLs. |
| AI/runtime helper calls | Some server helpers call Manus Forge APIs | Audit each actual production call. Replace any required LLM/notification capability with an independently owned provider before cutover, or leave that feature off until it has a replacement. |
| Scheduled work | Manus Heartbeat endpoint exists, but automatic collection is off by default | Keep automatic collection off at Render launch. Add a scheduler only after the client opts in and a signed, idempotent job is implemented. |
| Hosting / TLS / domain | Manus managed service and domain | Render Web Service, Render TLS, then custom-domain DNS cutover after staging passes. [3] |

## Recommended Target Architecture

The first independent deployment should keep the architecture intentionally small: one Render Node web service, one private MySQL 8 service, one auth provider, and one object-storage bucket. The app server remains the only component able to decrypt provider credentials or make an X provider request. Browser traffic continues to use tRPC; no browser-side calls to X providers will be added.

## Free Render Staging Constraint

The client has approved a fully free **staging-only** setup. Render states that a free web service spins down after 15 minutes without inbound traffic, can take about a minute to start again, and may restart at any time. Its free Postgres database has a 1 GB limit, expires after 30 days, has no backups, and is not recommended by Render for production applications. [5] Faro will therefore use free Render only for independent migration validation. The app must not be presented to paying clients or cut over from Manus until the client approves a durable database and always-available web service.

## Vercel and Neon Staging Pivot

Render’s API returned `402 Payment Required` while provisioning the client-approved free database, so the independent staging path has moved to the client-owned Vercel **Alpha** team. The client created and connected the `faro-ai-staging` project at `https://vercel.com/alpha-ea14/faro-ai-staging`, linked the private `ana-momin/Faro` repository, and installed the free Neon integration. Vercel confirms that Neon injected `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and associated Postgres values for Preview and Production. The migration branch uses `DATABASE_URL_UNPOOLED` for Drizzle migrations and must add independently generated session and credential-encryption secrets before deployment. No Manus application runtime or X-provider collection will be used in this staging environment.

| Layer | Recommended first-launch choice | Reason |
|---|---|---|
| Application | Render Node Web Service | Matches the current Express/tRPC process and supports Git-based deploys. [1] [3] |
| Database | Render private MySQL 8 service with a persistent disk, or a separately managed MySQL provider | Preserves the current Drizzle/MySQL schema and avoids an unnecessary PostgreSQL conversion. [4] |
| Authentication | **Clerk** (recommended for fastest migration) or **Supabase Auth** | Replaces Manus OAuth without weakening per-client data isolation. Final provider must be chosen before implementation. |
| Storage | Cloudflare R2 or Amazon S3 | Replaces `/manus-storage/*` with client-owned object storage. The AWS SDK is already a project dependency. |
| Secrets | Render service environment variables | Secrets stay outside Git; Render supports service-level environment variables and secret files. [2] |
| Monitoring | Render logs plus application-level error logging | Replaces dependence on the Manus dashboard for deployment visibility. |
| Scheduled collection | Disabled at launch | Faro’s strict bounded manual Search/Refresh contract remains intact and avoids accidental provider spend. |

Render accepts a connected private Git repository, runs the selected build/start commands, and can automatically deploy a linked branch after a successful push. [1] [3] The initial service configuration will use the project’s existing build and start scripts:

| Render setting | Planned value |
|---|---|
| Repository | `ana-momin/Faro` |
| Branch | A dedicated `render-migration` branch until final approval; `main` only after cutover approval |
| Runtime | Node.js 22 with pnpm |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start` |
| Health check | A new unauthenticated `/healthz` route returning only service status |
| Public port | `process.env.PORT`, bound to `0.0.0.0`; Render expects web services to bind to the service port. [3] |
| Auto-deploy | Disabled during migration; optionally enabled after production acceptance |

## Required Code Changes Before Deployment

The migration must be performed in a dedicated branch. No changes will be made directly to the current release branch until staging works.

| Area | Required change | Acceptance condition |
|---|---|---|
| Runtime bootstrap | Remove Manus-only runtime assumptions, serve the existing built static frontend, bind to Render’s assigned port, and add `/healthz`. | The service starts on Render and health checks pass. |
| Authentication | Replace Manus OAuth routes and SDK session checks. Map the new provider’s immutable subject to Faro’s user record. Retain role checks and cookie/session security. | Login, logout, session expiry, and cross-client authorization tests pass. |
| User migration | Add an authentication-provider subject field or perform a controlled user mapping. Do not reuse Manus `openId` as the permanent external identity. | Every imported user maps to exactly one new identity. |
| Database | Configure a new `DATABASE_URL`, apply migrations, import only reviewed data, and preserve foreign-key-equivalent relationships. | Row counts and key application queries match the migration report. |
| Provider encryption | Introduce a dedicated 256-bit encryption secret in Render. Re-encrypt only through a controlled server-side path, or require clients to reconnect. | No plaintext key is stored, logged, exported, or sent to the browser. |
| Storage | Replace Forge presign and `/manus-storage` routing with an R2/S3 adapter. | Upload, private retrieval, and profile-image rendering pass using new storage URLs. |
| Forge helpers | Remove/replace any production dependency on Forge LLM, notifications, maps, or other built-in APIs. | Each enabled feature has an independently owned credential and test. |
| Scheduling | Remove the Manus-only scheduled ingest route or make it dormant behind explicit configuration. | Automatic collection remains disabled by default; no background provider request is triggered at deploy. |
| Client configuration | Remove Manus-only public environment values and use the independent app URL/auth configuration. | Browser tRPC transport reaches the Render domain without credential or CORS errors. |

## Data Migration and Client-Credential Safeguards

The migration will use an export/import report rather than a blind database clone. Before any export, take a recoverable MySQL backup with a database-native tool. Render’s MySQL guidance specifically recommends `mysqldump` rather than relying on a disk snapshot as the application backup mechanism. [4]

| Data class | Migration action | Risk control |
|---|---|---|
| Users | Import profile metadata and map to newly authenticated accounts after first login or via a reviewed mapping file. | Do not trust email alone as an identity key. |
| Monitors, posts, reviews, saved posts, hidden posts, and search history | Export/import after user mapping is defined. Validate row counts and owner IDs. | Preserve user isolation; record reconciliation counts. |
| Provider connection rows | **Do not import by default.** Ask each client to reconnect their TwitterAPI.io or Official X credential after launch. | Existing ciphertext may depend on a secret that should not be exported or reused casually. |
| Profile images | Copy to R2/S3, write new URLs, and preserve the old mapping until visual verification. | Keep the Manus source available through the transition window. |
| Provider request ledger | Import only if client reporting continuity is needed. | Never treat it as an authorization source. |

## Ordered Migration Runbook

The following order avoids a live-service interruption and keeps the Manus deployment available as rollback protection.

1. **Freeze the baseline.** Confirm GitHub `main`, record the current Manus checkpoint, and create `render-migration` from that exact commit. No migration work occurs on `main`.
2. **Choose ownership services.** Confirm the Render team, region, auth provider, database host, object storage, and production domain. Create billing/access ownership under the client’s account, not a developer’s personal account.
3. **Create staging infrastructure.** Create a Render staging web service and private MySQL service. Add only staging secrets through Render’s Environment page; do not commit them. Render documents environment variables as the intended way to keep API keys and database strings out of source control. [2]
4. **Decouple platform code.** Replace Manus auth/runtime/storage/scheduler helpers in small reviewed commits. Keep the existing tRPC contracts and client UI unchanged wherever possible.
5. **Run offline validation.** Run the full test suite, TypeScript check, production build, and a staging health check. No X provider request is allowed during routine migration testing.
6. **Test auth and data isolation.** Create at least two staging users. Verify each can access only their own monitors, posts, saved items, hidden posts, and provider setup.
7. **Test storage and encrypted setup.** Upload a staging profile image, reconnect a staging-only provider key, confirm the UI sees only a masked hint, and verify no plaintext key appears in logs or browser responses.
8. **Optional explicit provider test.** Only after client approval, run exactly one bounded source request with a staging client-owned provider key. Verify one-provider-request enforcement and no automatic collection.
9. **Import production data.** Enable a short write freeze on the Manus app, export approved non-secret data, import into Render MySQL, migrate profile objects, and reconcile counts.
10. **Cut over domain.** Point the custom domain to Render only after staging smoke tests and data reconciliation pass. Render web services support custom domains and managed TLS. [3]
11. **Observe and rollback window.** Keep the Manus deployment intact and available for at least seven days. Watch authentication, tRPC errors, storage links, and provider error rates. Do not allow independent writes on both systems after cutover.
12. **Retire deliberately.** Only after acceptance, decide whether to retain Manus as a backup/preview environment or remove its remaining dependencies.

## Rollback Plan

Rollback is a DNS and application-routing operation, not an ad-hoc database merge. If production issues appear before data writes begin on Render, point the custom domain back to Manus and investigate in staging. If users have written data on Render after cutover, do **not** switch back silently; first assess data divergence and communicate the maintenance decision.

| Failure point | Immediate response | Safe recovery |
|---|---|---|
| Render build/start failure | Leave Manus live; do not change DNS. | Fix on the migration branch and redeploy staging. |
| Auth failure | Keep users on Manus. | Correct callback/domain/session configuration and retest with two staging users. |
| Database import mismatch | Stop cutover. | Restore from the pre-import backup and reconcile the import script. |
| Storage URLs broken | Keep old storage routes available. | Re-run object migration and URL rewrite; do not delete original files. |
| Provider connection issue | Disable collection for the affected user. | Ask client to reconnect their own key; never reuse or expose an old secret. |
| Post-cutover critical error | Enter maintenance mode and preserve logs. | Return traffic to Manus only after confirming no unaccounted Render writes, or perform a controlled data reconciliation. |

## Decisions and Access Required Before Implementation

The following items are required before any Render API action, migration code, or staging deployment begins.

| Required item | Owner | Decision needed |
|---|---|---|
| Render API key | Client | Create a least-privilege deployment key; never share the Render password. |
| Render team and region | Client | Confirm the client-owned Render workspace and preferred region. |
| Authentication provider | Client | Choose **Clerk** (recommended for fastest migration) or **Supabase Auth**. |
| Database choice | Client | Approve Render private MySQL 8 versus an external managed MySQL provider. |
| Object storage account | Client | Approve Cloudflare R2 or Amazon S3 for profile images and future files. |
| Domain | Client | Provide access to the domain registrar only at the final DNS cutover stage. |
| Data policy | Client | Approve migration of posts/history and confirm that clients will reconnect provider keys after launch. |
| AI/notification scope | Client | Confirm whether any Forge-backed features must be preserved in the first independent release. |
| Provider test | Client | Explicitly approve one bounded staging provider request only when ready; otherwise testing remains offline. |

## What Will Not Happen Until You Approve

No Render service will be created, no secret will be copied, no database will be exported, no provider key will be tested, no DNS record will be changed, and no Manus deployment will be removed. The first actual implementation action will be to create the **separate `render-migration` branch** and staging environment after the choices above are confirmed.

## References

[1]: https://render.com/docs/deploy-node-express-app "Render: Deploy a Node Express App"
[2]: https://render.com/docs/configure-environment-variables "Render: Environment Variables and Secrets"
[3]: https://render.com/docs/web-services "Render: Web Services"
[4]: https://render.com/docs/deploy-mysql "Render: Deploy MySQL"
[5]: https://render.com/docs/free "Render: Deploy for Free"
