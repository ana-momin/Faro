import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/renderSchema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers/monitoring.ts"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const searchSource = readFileSync(resolve(process.cwd(), "client/src/pages/Search.tsx"), "utf8");

describe("Faro Feed post removal", () => {
  it("records a user-scoped hidden X post and filters it before Feed and saved-post presentation", () => {
    expect(schemaSource).toContain('"hidden_posts"');
    expect(schemaSource).toContain("hidden_post_user_x_post_unique");
    expect(dbSource).toContain("hidePostForUser");
    expect(dbSource).toContain("listHiddenPostIdsForUser");
    expect(routerSource).toContain("removeFromFeed");
    expect(routerSource).toContain("storedPosts.filter(({ post }) => !hidden.has(post.xPostId))");
    expect(routerSource).toContain("rows.filter(({ post }) => !hidden.has(post.xPostId))");
  });

  it("offers the same confirmation-protected remove action in Feed and Search detail dialogs", () => {
    expect(homeSource).toContain("Remove post from Feed");
    expect(homeSource).toContain("Remove this stored post from your Feed?");
    expect(homeSource).toContain("trpc.monitoring.removeFromFeed.useMutation");
    expect(searchSource).toContain("trpc.monitoring.removeFromFeed.useMutation");
    // Search reuses the same shared PostDetailDialog (and its confirm dialog) rather than
    // duplicating the confirmation text, so the same wording is guaranteed by construction.
    expect(searchSource).toContain('import { PostDetailDialog, RequestCard } from "./Home"');
  });
});
