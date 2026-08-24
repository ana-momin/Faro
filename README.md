# Faro AI 🦊

> **Human-led social listening for buyer-side service requests on X.**

Faro AI helps teams find public X posts from people who are actively seeking practical help—such as AI agents, workflow automation, product testing, development, content production, and AI video. It prioritizes **real buyer demand** and keeps every external action human-controlled.

## Why Faro

Most social listening tools return broad keyword matches. Faro is designed to surface the more valuable signal: a person or team expressing a concrete need for delivered work.

| Faro surfaces | Faro excludes |
| --- | --- |
| First-party buyer requests for a defined service or outcome | People offering or promoting their own services |
| AI agents, workflows, automation, AI video, testing, development, and practical project work | Jobs, hiring, co-founder searches, networking, education, and generic discussion |
| Full public post context for a human reviewer | Automated outreach, messages, follows, or posting |

> **Human-control boundary.** Faro never sends a message, reply, follow, or post. A user reviews every qualifying request and decides what to do next.

## Product workflow

1. **Search** — Describe the buyer request in plain language or enter focused keywords. One deliberate source check runs per search.
2. **Feed** — Review complete buyer-request posts with author identity, category, signal context, and a direct link to X.
3. **Review** — Keep or dismiss a request in a dedicated human decision workspace. Decisions remain internal to Faro.

## Core capabilities

| Area | What it provides |
| --- | --- |
| Buyer-only ranking | Strict first-party request checks plus exclusion rules for providers, jobs, promotions, generic discussion, and networking noise. |
| Practical demand coverage | Search starting points for AI agents, automation, AI video, product testing, development, content/social work, contests, research, and design. |
| Full-post Feed | Social-style request cards with the complete post, author, handle, task category, signal score, engagement context, source link, and review action. |
| Credit-aware retrieval | Saved-result expansion never creates another provider request. New source checks happen only after an explicit user search. |
| Human review | Keep/Dismiss decisions are persisted without triggering communication or other external actions. |
| Member profile | Secure JPG, PNG, and WebP profile-photo uploads stored outside the database. |

## Technology

Faro is a full-stack TypeScript application built with **React 19**, **Vite**, **Tailwind CSS**, **tRPC**, **Express**, **Drizzle ORM**, and **MySQL-compatible storage**. It uses server-side source integrations and structured AI assistance without exposing provider credentials to the browser.

```text
client/        React workspace, Feed, Search, Review, Profile, and UI components
server/        tRPC procedures, buyer-intent ranking, source synchronization, and storage logic
drizzle/       Database schema and migrations
shared/        Shared constants and typed utilities
docs/          Demo guidance and external-source notes
```

## Local development

### Requirements

- Node.js 22+
- pnpm 10+
- A MySQL-compatible database

### Install and run

```bash
pnpm install
pnpm dev
```

The application requires its normal server environment for authentication, database access, and source integrations. Keep all credentials in environment variables or the host platform’s secure secret manager—never commit them to the repository.

### Common environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL-compatible database connection string. |
| `JWT_SECRET` | Session signing secret. |
| `TWITTERAPI_IO_KEY` | Optional server-side key for controlled public X searches. |
| `X_API_BEARER_TOKEN` | Optional server-side X API access path. |
| `BUILT_IN_FORGE_API_KEY` | Server-side platform integration key when using the managed runtime. |

## Quality checks

```bash
# Type safety
pnpm check

# Full automated test suite
pnpm test

# Production build
pnpm build
```

The test suite covers buyer-intent rules, service-offer rejection, source handling, search lifecycle behavior, Feed selection, profile image validation, and review-safe interactions.

## Data, privacy, and safety

Faro works with public X post data and preserves the distinction between a source signal and a verified business opportunity. It does not access private content, does not store source credentials in the client, and does not automate outreach.

## Contributing

Keep changes focused, typed, and covered by tests. Before opening a pull request, run `pnpm check` and `pnpm test`, avoid committing generated runtime files or secrets, and preserve Faro’s buyer-only and human-control constraints.

## License

This project is released under the [MIT License](./LICENSE).
