# Faro Submission Demonstration

## Product access

Faro is an authenticated, responsive X signal-review workspace. Its source code is contained in the project checkpoint, and the hosted project can be published from the project interface. The application deliberately supports **review only**: it cannot send outreach, post, reply, or message anyone.

## Required natural-language demonstration

| Step | Action | Observed outcome |
|---|---|---|
| 1 | Open **New signal** and enter `People asking for help building custom AI workflows for a small business`. | The application accepts a plain-English monitoring goal. |
| 2 | Select **Suggest**. | A server-side model is given up to 12 seconds. If it is unavailable or slow, the deterministic relevance profile returns a usable rule rather than leaving the interface pending. |
| 3 | Review the generated rule. | `("custom ai workflows" OR "ai workflows") ("looking for" OR "need help" OR recommend OR hire) -job -giveaway -is:retweet` |
| 4 | Save **Custom AI workflow help requests** and select **Sync**. | The live provider returned normalized public posts, identified in the interface as **Alt. X API — TwitterAPI.io Advanced Search**. |
| 5 | Open a ranked post. | The review detail provides author, post text, timestamp, engagement, personalized score explanation, and an **Open on X** link. Approve and Reject only change the human-review decision; neither action sends any external communication. |

## Saved evidence

| Artifact | What it proves |
| --- | --- |
| [Natural-language rule capture](/manus-storage/signalforge-natural-language-rule_c2048444.webp) | The plain-English intent resolves to an editable rule that preserves high-signal multi-word concepts. |
| [Live-result review capture](/manus-storage/signalforge-live-review-controls_04506c3d.webp) | A live result exposes a direct X link, transparent scoring detail, and human-only Approve/Reject controls. |

> **Human-control boundary.** Faro indexes and ranks public posts for a person to review. It never writes to X, initiates outreach, posts, replies, follows accounts, or sends direct messages.
