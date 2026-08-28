<p align="center">
  <img src="client/public/favicon.svg" width="72" height="72" alt="Faro AI logo" />
</p>

<h1 align="center">Faro AI</h1>

<p align="center"><strong>Human-led social listening for buyer-side service requests on X.</strong></p>

<p align="center">
  <a href="#client-workflow">Workflow</a> ·
  <a href="#client-provider-setup">Provider setup</a> ·
  <a href="#project-documentation">Documentation</a> ·
  <a href="#development">Development</a> ·
  <a href="#production-deployment">Deployment</a>
</p>

Faro AI finds public X posts from people who are actively seeking practical help with AI agents, automation, development, product testing, AI video, content, and related delivery work. It is designed to surface **buyer-side demand**, not service offers, jobs, promotions, networking, or generic discussion.

> **Human-control boundary:** Faro never sends messages, replies, follows, likes, or posts on X. It provides evidence and ranking for a human reviewer to decide what happens next.

## Project documentation

The current independent Vercel + Neon implementation and its protected staging workflow are documented in [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md). Read it before making a code, deployment, credential, database, or provider-collection change.

For a short, non-technical explanation of the product, client journey, cost boundaries, and current readiness, read [`docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md).

## Client workflow

| Step | What happens | Provider usage |
| --- | --- | --- |
| **Provider** | A client connects their own TwitterAPI.io key or Official X API bearer token in **Profile → Provider**. | No request is made when saving a key. |
| **Search** | The client writes a buyer-intent brief or uses a ready-made suggestion. Faro creates a saved monitor and collects one fresh batch. | **At most one provider request.** |
| **Feed** | Faro shows the first ten qualified requests and keeps earlier qualified posts stored for review. | Viewing saved results uses **no** provider request. |
| **Refresh** | The client deliberately collects the next cursor/query-family batch. | **At most one provider request.** |
| **Review** | The client opens full X-post context, saves a private bookmark or note, and keeps or dismisses the signal. | No provider request and no external action. |

Faro rotates through persisted discovery-query cursors so sequential batches broaden coverage while preserving earlier qualified results. Automatic source collection is **off by default**. Each client has an adjustable daily request limit in Profile, tracked independently from other accounts.

## Client provider setup

Faro stores exactly one active provider connection for each account. The key is encrypted with AES-256-GCM before it is stored, and the browser receives only a masked final-four-character hint after setup. Full credentials are never rendered back into the UI or committed to the repository.

| Provider | When to use it | Client account links |
| --- | --- | --- |
| **TwitterAPI.io** | A third-party X data provider using its own account, credits, and advanced-search endpoint. | [Pricing](https://twitterapi.io/pricing) · [Dashboard / key setup](https://twitterapi.io/dashboard) · [Advanced Search docs](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search) |
| **Official X API** | The direct X developer platform with the client’s own bearer token and account entitlements. | [Pricing and credits](https://docs.x.com/x-api/getting-started/pricing) · [Developer Console](https://developer.x.com/) |

Provider rates, limits, account entitlements, and endpoint costs are controlled by the provider and may change. Faro therefore promises only its own deterministic guardrails—**one provider request per client-initiated collection batch**—rather than a fixed cash or credit cost.

## Core capabilities

| Area | Capability |
| --- | --- |
| **Natural-language query understanding** | A search brief such as "founders looking for a provider to build AI agents" is turned into search terms and an X query by an LLM (with an automatic deterministic fallback if no LLM key is configured). See [`server/monitoring/ai.ts`](./server/monitoring/ai.ts). |
| **Buyer-only ranking** | LLM-assisted per-post intent classification plus a deterministic scoring layer — request-intent signals, delivery-scope evidence, personalized preference boosts, duplicate grouping, and promotional/noise suppression. |
| **Social Feed** | Full X-style cards with author context, category, confidence, why-it-matched evidence, direct X links, compact feedback controls, and private saved posts. |
| **Search workspace** | Centered LLM-style command bar, full-line suggestion prompts, keyword mode, in-bar progress, and top-ten qualified results. |
| **Monitor manager** | Rename, pause/resume, or delete saved searches from Profile. |
| **Client credit protection** | Encrypted client-owned data-provider setup, strict batch caps, client-scoped daily request allowance, and no background collection by default. |
| **Safe review** | Keep/Dismiss and private notes guide later Faro ranking while never automating outreach or other X actions. |

## Architecture

```text
client/     React 19 + Vite + Tailwind interface
server/     Express + tRPC, collection policy, intent/ranking, encrypted provider settings
drizzle/    MySQL-compatible schema and ordered migrations
docs/       Provider, collection, verification, and deployment documentation
shared/     Typed utilities and shared constants
```

The application uses React 19, TypeScript, Vite, Tailwind CSS, Express, tRPC, Drizzle ORM, and MySQL-compatible storage. Provider calls remain server-side; no provider credential is exposed in the browser.

## Development

### Requirements

- Node.js 22 or later
- pnpm 10 or later
- A MySQL-compatible database
- Authentication configuration for the chosen runtime

### Install and run

```bash
pnpm install
pnpm dev
```

### Database migrations

The migrations in `drizzle/` are ordered and must be applied before running a version that depends on them.

```bash
# Generate a migration only after changing drizzle/schema.ts
pnpm drizzle-kit generate

# Apply existing migrations to the configured database
pnpm drizzle-kit migrate
```

The current schema includes `provider_connections`, which stores an encrypted client-owned credential and its request-limit preference. Do not insert plaintext provider keys directly into this table.

### Quality checks

```bash
pnpm check
pnpm vitest run --exclude server/twitterApiIo.credentials.test.ts --exclude server/xApi.credentials.test.ts
pnpm build
```

Credential endpoint probes are intentionally excluded from routine offline validation because they contact a provider account. Treat any live provider test as a deliberate client-authorized operation with an explicit cap.

## Production deployment

### Recommended launch path

The current project is production-ready for its managed deployment: it includes the full Express/tRPC backend, MySQL-compatible database, session authentication, secure secret management, encrypted client provider credentials, and published migrations. A custom domain can be attached in the hosting settings.

### Authentication decision

**Do not remove authentication for this multi-client product.** Faro stores private bookmarks, notes, monitors, and encrypted provider credentials. Removing login would make client isolation and credential ownership unsafe. The current managed OAuth integration is appropriate for this deployment path and does not require Faro to purchase a separate identity API.

If Faro moves to another host, its present login system is not portable as-is: `server/_core/oauth.ts` exchanges tokens through the managed OAuth service. A third-party deployment must replace that integration with a production identity provider or an owned authentication implementation before launch. This is a planned migration, not a one-click host change.

### External-hosting assessment

| Target | Current suitability | What would be required |
| --- | --- | --- |
| **Managed Faro deployment** | **Recommended now.** The existing backend, database, session flow, storage, and scheduled-work integration are already wired together. | Configure a custom domain if desired; keep secrets managed by the host. |
| **Vercel** | **Not a direct deploy today.** Faro is an Express server, not a serverless function layout, and relies on managed OAuth/runtime integrations. | Convert Express/tRPC endpoints to Vercel functions, provision MySQL and object storage, replace managed OAuth, and rework any scheduled tasks. |
| **Google Cloud Run** | **The more natural external target** for this Express application, but still a migration. | Deploy the Node server container, use Cloud SQL or compatible MySQL, configure object storage, replace OAuth, add a secret manager, configure HTTPS/domain, and migrate scheduled jobs. |

For launch, keep the managed deployment. Move to Cloud Run only when you intentionally want to own the full cloud stack and have completed the authentication, storage, secret-management, and database migration work. Do not treat a Vercel or Google Cloud deployment as equivalent until that migration is implemented and tested.

## Security and privacy

- Provider credentials are accepted only through authenticated server procedures and encrypted at rest with AES-256-GCM.
- The client interface only receives a masked credential hint after a key is saved.
- Provider calls are client-scoped, deliberately bounded, and are never made during normal UI rendering.
- Public X posts are treated as signals; a human reviewer makes all business decisions and external actions.
- Keep `DATABASE_URL`, `JWT_SECRET`, OAuth settings, provider keys, and managed-runtime secrets in a secure host secret manager. Never commit them.

## Repository hygiene

The repository deliberately excludes dependency folders, build output, local environment files, logs, runtime artifacts, and generated preview files. Before opening a pull request or deploying a code change, run the quality checks above and review every database migration.

## License

Released under the [MIT License](./LICENSE).
