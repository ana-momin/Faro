# SignalForge Submission Demonstration

## Product access

SignalForge is an authenticated, responsive X social-listening workspace. Its source code is contained in the project checkpoint, and the hosted project can be published from the project interface. The application deliberately supports **review only**: it cannot send outreach, post, reply, or message anyone.

## Required natural-language demonstration

The following flow was run against the configured public-post source on **23 August 2026**.

| Step | Action | Observed outcome |
|---|---|---|
| 1 | Open **New monitor** and enter `People asking for help building custom AI workflows for a small business`. | The application accepts a plain-English monitoring goal. |
| 2 | Select **Suggest**. | The server-side model is given up to 12 seconds. If it is unavailable or slow, the deterministic fallback returns a usable rule rather than leaving the interface pending. |
| 3 | Review the generated rule. | `("custom ai workflows" OR "ai workflows") ("looking for" OR "need help" OR recommend OR hire) -job -giveaway -is:retweet` |
| 4 | Save **Custom AI workflow help requests** and select **Sync**. | The live provider returned 20 normalized public posts, identified in the interface as **Alt. X API — TwitterAPI.io Advanced Search**. |
| 5 | Open a ranked post. | The review detail provides author, post text, timestamp, engagement, score explanation, and an **Open on X** link. Approve and Reject only change the human-review decision; neither action sends any external communication. |

## What reviewers should check

The resulting opportunity feed labels each record with its source monitor. The live sample includes public posts under **Custom AI workflow help requests**, while the seeded onboarding examples stay visibly marked **Demo sample**. This distinction is intentional: reviewers can tell real provider output apart from teaching data.

## Saved revised evidence

The following captures were made after the revised brief was implemented. They are intentionally separate so the generated rule and the human-only review controls are legible.

| Artifact | What it proves |
| --- | --- |
| [Natural-language rule capture](/manus-storage/signalforge-natural-language-rule_c2048444.webp) | Visibly shows the complete plain-English intent, the deterministic editable rule preserving `custom ai workflows` and `ai workflows`, the **Alt. X API** live-source card, a queued live/demo review count, and a demo-free manual-review-only note. |
| [Live-result review capture](/manus-storage/signalforge-live-review-controls_04506c3d.webp) | Visibly shows ranked rows under **Custom AI workflow help requests**, a separately labeled **Demo: AI workflow requests** row, the selected live-result intent explanation, a direct **Open on X** link, and **Approve**/**Reject** controls. The text below the controls states that the action only stores a human-review label and never triggers communication. |

The interface also exposes a clear source-health card. It reports the active provider and its latency mode. If an official X API token lacks paid retrieval entitlement, the app surfaces that status rather than implying a successful official-X sync. When the configured alternative provider has a credit or rate-limit failure, that error is also preserved visibly.

## Setup summary

The server accepts `X_API_BEARER_TOKEN` for the official X API and `TWITTERAPI_IO_KEY` for the configured alternative public-post provider. The app prefers the configured alternative provider when its key is available; otherwise it uses official Recent Search, while retaining support for Filtered Stream on documented persistent hosting. Refer to [README.md](../README.md) and [external_sources.md](external_sources.md) for detailed environment and provider notes.

> **Human-control boundary.** SignalForge indexes and ranks public posts for a person to review. It never writes to X, initiates outreach, posts, replies, follows accounts, or sends direct messages.
