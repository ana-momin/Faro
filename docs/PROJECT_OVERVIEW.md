# Faro AI: Simple Project Overview

## What Faro AI Is

Faro AI is a web application that helps a client find public X posts from people who are **asking for help**, rather than people advertising their own services. It is designed for opportunities such as a founder needing an AI agent built, a team seeking workflow automation, or a business looking for testing, development, content, or video support.

Think of it as a focused social-listening desk. It turns a broad stream of public posts into a smaller list of buyer-side requests that a person can review and act on manually.

> Faro AI identifies possible opportunities. It never contacts anyone, posts on X, follows accounts, likes posts, or sends messages automatically.

## The User Journey

| Step | What the user does | What Faro does |
| --- | --- | --- |
| 1 | Opens Faro in a browser | Shows a passkey sign-in screen. No download is needed. |
| 2 | Creates or uses a device passkey | Securely opens that user’s private Faro workspace. |
| 3 | Opens **Settings → Provider** and connects a supported X data provider | Encrypts the provider credential on the server and lets the user set a daily source-call limit. |
| 4 | Writes a Search request | Converts the request into several buyer-focused source queries. |
| 5 | Reviews qualified X posts | Shows the strongest recent buyer requests, why they matched, post details, and a direct X link. |
| 6 | Saves, keeps, dismisses, or hides posts | Stores private review preferences without taking an action on X. |

## What a Good Search Looks Like

A good Faro Search explains both **who needs help** and **what work they need done**. For example:

- “Find founders looking for a provider to build or implement AI agents.”
- “Find teams that need help automating client intake workflows.”
- “Find businesses seeking a developer to build and test an AI product.”
- “Find people asking for an AI video or content creator.”

General-topic requests, such as entertainment news, sports, game leaks, or memes, are not Faro’s purpose. The app blocks clearly unrelated prompts before they spend provider credits and guides the user back to buyer-service discovery.

## How Search Protects Credits

Each client owns their provider account and decides the daily source-call allowance. New provider connections start with a conservative default of **10 calls per day**, which can be changed later. The app does not poll or collect automatically.

| Action | Uses provider credits? |
| --- | --- |
| Opening Faro, Feed, Search, or Settings | No |
| Opening a saved search or changing the saved-result time filter | No |
| Showing ten more results already saved by Faro | No |
| Running a new Search | Yes, within the user’s daily cap |
| Refreshing or loading a next cursor-backed page | Yes, only when the user deliberately requests it and budget remains |

Faro avoids unnecessary collection by reopening an identical saved Search instead of running it again. It also blocks exact duplicate X post IDs across saved searches, so the same source post does not keep consuming storage or appearing as a new discovery.

## Why Results Can Vary

Faro prefers quality over simply showing any post that mentions AI. To appear as a qualified result, a post must show a credible buyer-side request and a relevant delivery need. Posts offering services, advertising, recruiting for permanent jobs, looking for work, sharing a course, or casually discussing a topic are filtered out.

This means some searches will return fewer than ten posts. Result volume depends on the live public inventory, the wording users use on X, the chosen date window, the provider response, and the buyer-only qualification rules. Faro aims for up to ten recent qualified results when they exist; it does not fabricate posts or promise a guaranteed count.

## Where It Runs

Faro AI is hosted at [tryfaro.vercel.app](https://tryfaro.vercel.app/), with [faro-ai-staging.vercel.app](https://faro-ai-staging.vercel.app/) kept as a secondary address pointing at the same deployment. It runs on Vercel with a Neon PostgreSQL database, deployed from `main` — the single active branch.

| Part of the product | Plain-language role |
| --- | --- |
| **React web interface** | The pages a client sees: Search, Feed, Settings, saved posts, and post details. |
| **Server API** | Keeps source calls and provider credentials off the browser. |
| **Neon database** | Stores passkey accounts, saved searches, posts, review choices, and encrypted provider connection details. |
| **X provider** | Supplies public X post data when a client manually runs a Search or refresh. |

## Provider Cost in Plain Language

Faro itself is not configured with an in-app subscription. A client chooses and pays for an X data provider such as TwitterAPI.io or the Official X API. Faro’s job is to keep that provider usage deliberate and bounded.

TwitterAPI.io currently advertises $0.10 in free signup credit without a card, equal to 10,000 credits at its published conversion rate. This is a third-party offer that can change, so clients should confirm the current offer and pricing directly in the provider dashboard before collecting posts. [1] [2]

## What Is Ready and What Still Needs a Real User Check

The application has passed offline code tests, type checks, and production builds, and its staging shell is deployed. Its most important remaining acceptance checks are a real device passkey enrollment/sign-in and one user-approved, credit-bounded live provider Search. Those steps should be done before presenting Faro as a fully production-certified paid-client service.

For day-to-day testing or product demonstrations, Faro can be described as a polished staging prototype with manual, client-owned source usage and human-led review.

## References

[1]: https://twitterapi.io/ "TwitterAPI.io homepage"

[2]: https://twitterapi.io/pricing "TwitterAPI.io pricing"
