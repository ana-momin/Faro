# TwitterAPI.io Pagination Reference

Verified on 2026-08-27 for Faro AI’s provider-bounded Search design.

The [TwitterAPI.io Advanced Search endpoint](https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search) accepts `query`, `queryType=Latest`, and a `cursor`. The first page uses an empty cursor; subsequent pages use `next_cursor`. The response exposes `tweets`, `has_next_page`, and `next_cursor`, and each page returns up to 20 posts.

The provider’s [advanced-search guide](https://twitterapi.io/blog/twitter-advanced-search-api-guide) confirms that pagination should follow the returned cursor until it is absent or the application’s configured safety cap is reached. Faro therefore keeps continuation cursors per query family, never reuses a cursor as a fresh search, deduplicates post IDs, and keeps continuation behind the client’s daily provider-call limit. The current client-facing cap is at most three provider pages per user-initiated collection action; a continuation is offered only when a stored cursor exists.
