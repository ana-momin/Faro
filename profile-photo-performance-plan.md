# Faro AI Profile Photo Fast-Load Plan

## Goal

Make the authenticated member profile photo on the **Profile** screen appear immediately or transition in smoothly on both a direct Profile visit and navigation from another Faro workspace section. The improvement will preserve the existing server-side storage flow, file validation, and database `avatarUrl` reference.

## Current Finding

The Profile screen receives the photo URL through `useAuth()` and begins rendering its large `AvatarImage` only after the Profile route is selected. Although the persistent sidebar now helps warm the browser cache during in-app navigation, a direct Profile load can still wait for the storage image request. The shared avatar fallback delay prevents a quick initials flash but does not proactively start the image request.

## Implementation Steps

1. Add a small shared profile-image preload utility or hook that safely starts loading a valid stored `avatarUrl` as soon as authenticated workspace data is available. It will be invoked from the persistent workspace shell, not from a search or provider workflow.

2. Add an explicit high-priority image hint for the large Profile avatar and preserve intrinsic avatar sizing. The visual avatar will retain its initials fallback until the actual image is ready, then transition only opacity so the layout never shifts or flashes.

3. Keep the URL stable after upload and do not add cache-busting query strings, client-side blob persistence, or public credential handling. The existing secure storage URL and server upload validation will remain the source of truth.

4. Add focused regression coverage for the preload and Profile avatar rendering contract. Update the existing profile or sidebar tests to confirm that the faster path does not remove fallback accessibility, upload validation, or persisted avatar display.

5. Validate direct Profile entry and normal navigation to Profile at desktop and mobile sizes without running an X/Twitter source search. Run the local test suite and TypeScript checks, then save a single checkpoint.

## Validation Plan

| Area | Verification |
|---|---|
| Direct Profile visit | Confirm the image request is initiated as soon as authenticated workspace data is available and the profile card remains dimensionally stable. |
| In-app navigation | Confirm the sidebar and Profile avatar reuse the already warmed image without a visible fallback flash. |
| Mobile and desktop | Verify the profile card, image crop, and mobile header remain responsive. |
| Regression safety | Run focused avatar/profile tests, the local suite, and `pnpm check`; do not repeat an external provider credential test if it is unrelated or times out. |

## Assumptions and Risks

The plan assumes the stored `avatarUrl` is a cacheable `/manus-storage/` URL and that photos remain within the existing JPG/PNG/WebP and 2 MB constraints. A direct first-time visit is still bounded by network latency, but preloading, priority, and a stable visual placeholder will remove avoidable wait and flicker. No database migration, X provider call, outreach action, or background process is required.
