# Faro AI Production Deployment Notes

Faro AI is currently prepared for its managed full-stack deployment. The application combines an Express/tRPC API, MySQL-compatible database, encrypted client-owned provider credentials, session authentication, profile image storage, and optional scheduled infrastructure. These components should be deployed together rather than treated as a static frontend.

## Launch checklist

| Area | Required production state |
| --- | --- |
| Database | Apply all committed `drizzle/` migrations, including `0010_living_red_hulk.sql`. |
| Secrets | Configure `DATABASE_URL`, `JWT_SECRET`, OAuth runtime settings, and managed service secrets through the host’s secure secret manager. |
| Client data provider | Each client connects their own TwitterAPI.io key or Official X API bearer token in **Profile → Provider**. Do not share one provider key between clients. |
| Collection spend | Keep the default daily request allowance at 20 until the client understands their provider account cost model. Each Search or Refresh consumes no more than one provider request. |
| Collection automation | Keep automatic collection disabled unless a client explicitly opts in and an appropriate scheduled infrastructure is configured. |
| Domain and HTTPS | Use HTTPS before enabling real client accounts, because session cookies and OAuth redirects require a secure context. |
| Observability | Monitor application errors, provider rate-limit/payment responses, and database migration status before expanding client volume. |

## Authentication boundary

The current login implementation is a managed OAuth flow. It should be retained for the managed deployment because clients own private monitors, saved posts, review decisions, and encrypted provider connections. Authentication must not be removed for production multi-client use.

Moving to an external cloud requires an explicit authentication migration: replace the managed OAuth exchange with an independently configured provider, preserve the existing CSRF/session protections, update callback URLs for the new HTTPS domain, and test login, logout, session expiry, and user-data isolation before launch.

## Hosting decision

Use the existing managed deployment for the first client launch. The app’s backend and database integrations are already compatible with it. An external Cloud Run deployment is feasible later, but requires a full ownership migration for OAuth, MySQL, storage, secrets, domain configuration, and scheduled work. Vercel would require an additional serverless refactor and therefore is not a direct production target for the present Express application.

## Provider references

- [TwitterAPI.io pricing](https://twitterapi.io/pricing)
- [TwitterAPI.io dashboard](https://twitterapi.io/dashboard)
- [Official X API pricing and credits](https://docs.x.com/x-api/getting-started/pricing)
- [Official X Developer Console](https://developer.x.com/)
