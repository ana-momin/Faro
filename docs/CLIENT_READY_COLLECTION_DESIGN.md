# Client-Ready Collection Design

## Product contract

Each Faro AI account brings one active provider credential: either a **TwitterAPI.io API key** or an **Official X API bearer token**. The key is accepted only over the authenticated application connection, encrypted before database storage, and never returned to the browser after saving. No shared server provider credential is used for client-initiated collection.

## Strict collection batch

A user-initiated Search or Feed **Next batch** action makes at most **one provider request**. The request selects the least recently checked discovery-query family, persists only qualified buyer-side posts, and advances that family’s continuation cursor. Faro shows up to ten qualified results in the first visible window; previously collected qualifying posts remain available through the existing saved-result expansion and Profile bookmarks without new provider activity.

## Spend controls

Each provider configuration has a client-scoped daily request allowance, set to 20 by default and adjustable in Profile. Source-call usage is calculated only from that client’s monitor ledger. Automatic polling is disabled by default for client-owned connections; it can only run when the client explicitly enables it later. Faro labels actions by its deterministic application behavior, such as **“1 source request”** or **“saved results — no source request.”** It never converts these actions into a promised provider-credit price because provider endpoint pricing and entitlements vary.

## Provider setup guidance

Profile shows a compact provider selector, a masked configured state, a replace-key action, an optional daily request cap, provider information tooltips, and official purchase/documentation links. The explanatory copy distinguishes the independent TwitterAPI.io service from Official X API and directs clients to each provider’s own current pricing information.

## Navigation verification

Desktop and 375 px mobile checks confirm that the Profile navigation now includes the **Provider** entry alongside Profile, Saved, and Monitors without horizontal overflow. No provider key was entered and no source request was triggered during visual verification.

## Feed and Search verification

Desktop and 375 px mobile checks confirm that Feed retains a compact Refresh entry and Search retains its centered command bar after the client-ready collection changes. Feed continues to begin with ten visible posts and Search is labeled to return the top ten qualified requests. No Refresh, Search, or provider request was triggered during these checks.

## Provider-aware Feed onboarding — 25 August 2026

The no-monitor Feed state now distinguishes the prerequisite provider setup from creating a buyer brief. Without a provider, Faro directs the client to **Profile → Provider** and renders a truly disabled **Run first batch** control; once configured, it directs the client to create their first search brief. Desktop and 375 px mobile Feed checks remained stable. No provider request was triggered during these checks.

## Direct Provider navigation — 25 August 2026

Saved, Monitors, and Provider are now first-class sidebar destinations rather than crowded Profile top-bar tabs. The Feed configuration action routes directly to `/provider`, where the credential setup surface is immediately visible; the Profile page now retains only personal account content. Desktop checks confirmed correct route highlighting and no source request was triggered.

Mobile verification at 375 px confirms the direct Provider setup view and cleaner Profile page remain readable without the former top-tab row. No provider credential was entered and no source request was triggered.

## Compact sidebar account menu — 25 August 2026

The main sidebar now retains only Feed, Search, and Profile. Saved, Monitors, and Provider are available from the account menu at the bottom, avoiding a crowded primary list. A visible desktop minimize/expand control is restored beside the wordmark and the compact icon state retains navigation tooltips. Desktop and 375 px mobile Feed and Provider checks confirmed the new placement without provider activity.

## Bottom minimize control — 25 August 2026

The sidebar minimize/expand control now sits in the footer directly above the signed-in account name and email, matching the requested placement. Desktop verification confirmed that it is visible, centered, and separated from the account action; the mobile header control remains unchanged. No provider request was triggered.

## Account settings cue — 25 August 2026

The bottom account entry now includes a subtle settings icon and an accessible “Open workspace settings” label, making the available Saved, Monitors, Provider, and sign-out controls discoverable. The duplicate Profile item has been removed because Profile is already a primary sidebar destination. Desktop and 375 px mobile checks remained stable with no provider activity.

## Dedicated Settings workspace — 25 August 2026

Provider, Monitors, and Saved are now consolidated into a dedicated Settings workspace that is placed between Search and Profile in the primary navigation. The desktop Provider default view confirms the repeated “Your Faro AI space,” personalized greeting, and private-workspace badge are no longer present on secondary controls. The old bottom account dropdown has been removed. No credential or source request was used during verification.

Direct desktop route checks confirm that Monitors and Saved dynamically render inside the same Settings layout with the correct active side-panel state. The Settings workspace preserves monitor status controls and saved-post notes/priority tools while keeping Profile’s personal header out of these secondary views. No credential or source request was used.

Mobile verification at 375 px confirms Provider, Monitors, and Saved remain dynamically reachable through a horizontally scrollable, active-state Settings control strip. The content stays readable without reintroducing the Profile greeting or bottom account dropdown. No credential or source request was used.

## Settings switching and footer refinement — 25 August 2026

The Settings selector now updates its displayed content immediately on click as well as on direct route changes; desktop verification confirmed Provider and Monitors render correctly. The Settings introduction block has been removed. The footer account row is again a clear Profile action with a disclosure chevron, while the minimize control is a compact left-aligned icon above it rather than a full-width bar. No credential or source request was used.

Mobile verification at 375 px confirms Provider and Monitors switch their content correctly, the removed Settings introduction does not return, and the Profile entry remains a clear distinct destination. No credential or source request was used.

## Settings hierarchy and account actions — 25 August 2026

The Settings workspace now has a deliberate top inset, softer navigation-card depth, and clearer active-state hierarchy. The compact minimize control is right aligned above the account row. The account row now visibly opens an account-action menu, signaled by an overflow affordance and providing Profile and sign-out actions. Desktop checks confirmed the layout without provider activity.

Mobile verification at 375 px confirms the added Settings breathing room and clean horizontal section navigation; Profile remains distinct and readable. No credential or source request was used.
