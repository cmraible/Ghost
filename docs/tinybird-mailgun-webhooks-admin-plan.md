# MVP Plan: External Email Analytics For Post Analytics

## Goal

Prove that Ghost can read email analytics from an external OLAP-backed service for the Post Analytics page only.

This is the page a publisher sees immediately after sending an email, so it is the best first slice: narrow, visible, and easy to compare against the existing MySQL-backed values.

When disabled, Ghost should behave exactly as it does today.

When enabled, Ghost should keep the existing Mailgun polling jobs and MySQL aggregation running, but the Post Analytics page should display send/open metrics read from the external service.

## MVP Scope

Migrate only the Post Analytics email metrics:

- sent / recipient count
- opened count
- open rate

Keep these existing data sources unchanged:

- Mailgun polling jobs
- `email_recipients` writes
- `emails.email_count` and `emails.opened_count` aggregate updates
- click metrics
- feedback metrics
- member growth metrics
- visitor metrics from Tinybird
- newsletter average/comparison cards unless they already use the migrated post-level stats
- member analytics
- top posts / site-wide analytics

## Current Post Analytics Read Path

The Post Analytics view currently reads email stats from the post response:

- `apps/posts/src/hooks/use-post-newsletter-stats.ts`
- `post.email.email_count`
- `post.email.opened_count`
- local calculation of `openedRate`

The backend also has a focused post stats endpoint:

- Admin API: `/ghost/api/admin/stats/posts/:id/stats/`
- Endpoint: `ghost/core/core/server/api/endpoints/stats.js`
- Service method: `ghost/core/core/server/services/stats/posts-stats-service.js#getPostStats`
- Current response fields:
  - `recipient_count`
  - `opened_count`
  - `open_rate`
  - `member_delta`
  - `free_members`
  - `paid_members`
  - `visitors`

For the MVP, prefer the focused stats endpoint as the integration point. It already separates analytics from the full post payload and can preserve the existing Admin API shape.

## Proposed UX/Data Flow

1. Admin opens the Post Analytics page after a send.
2. The page calls the post stats endpoint.
3. Ghost loads post identity and non-email stats from MySQL/Tinybird as it does today.
4. If external reads are enabled, Ghost asks the external service for email metrics for the post's email/send.
5. Ghost returns the same post stats response shape, with only these fields replaced:
   - `recipient_count`
   - `opened_count`
   - `open_rate`
6. If external reads are disabled or fail, Ghost returns the existing MySQL values.

## Configuration

Use config for this spike because the integration needs connection details.

Suggested shape:

```json
{
    "emailAnalytics": {
        "postAnalyticsExternalReads": {
            "enabled": false,
            "baseUrl": "https://api.us-east.tinybird.co/v0/pipes/post_email_analytics.json",
            "apiKey": "...",
            "timeoutMs": 2000,
            "fallbackToMysql": true
        }
    }
}
```

Defaults:

- `enabled`: `false`
- `timeoutMs`: `2000`
- `fallbackToMysql`: `true`

The name is intentionally scoped to Post Analytics so this does not imply that all email analytics reads have moved.

## External API Contract

Keep the external contract to one endpoint for the MVP.

`GET https://api.us-east.tinybird.co/v0/pipes/post_email_analytics.json?token=<token>&email_id=<email_id>`

Response:

```json
{
    "data": [
        {
            "email_id": "email-id",
            "recipient_count": 1000,
            "opened_count": 540,
            "open_rate": 54
        }
    ]
}
```

Notes:

- Query by Ghost `email_id`, not only `post_id`.
- `baseUrl` should be the full Tinybird pipe URL, without `token` or `email_id`.
- `apiKey` is passed as Tinybird's `token` query parameter.
- Ghost already knows which `emails` row belongs to the post.
- Mailgun events can be grouped by the Ghost email/send identifier.
- The external service does not need to know about posts, newsletters, members, or Admin UI concepts for this slice.

Optional later extension:

`POST /v1/post-email-analytics/batch`

Do not add batch support until we migrate a list view or newsletter comparison that needs it.

## Backend Implementation Plan

### 1. Add A Small Client

Add a narrowly scoped client for the external endpoint.

Suggested location:

- `ghost/core/core/server/services/email-analytics/external-post-analytics-client.js`

Responsibilities:

- read config
- call the configured Tinybird pipe URL
- append `token=<apiKey>` and `email_id=<email_id>`
- pass auth header
- enforce timeout
- validate response shape
- return normalized values:
  - `recipient_count`
  - `opened_count`
  - `open_rate`

### 2. Update `getPostStats`

Update:

- `ghost/core/core/server/services/stats/posts-stats-service.js#getPostStats`

Current query already loads:

- `posts.id`
- `posts.uuid`
- `posts.published_at`
- `emails.email_count`
- `emails.opened_count`

It should also load:

- `emails.id as email_id`

Then:

1. Compute the current MySQL-backed metrics as the fallback.
2. If config is disabled, return the current values.
3. If config is enabled and `email_id` exists, call the external client.
4. Replace only `recipient_count`, `opened_count`, and `open_rate` with external values.
5. Keep `member_delta`, `free_members`, `paid_members`, and `visitors` unchanged.
6. On error, log and return MySQL values if `fallbackToMysql` is true.

### 3. Keep The Admin API Shape Stable

Do not add a new public Admin API endpoint for this spike.

Keep using:

- `/ghost/api/admin/stats/posts/:id/stats/`

This makes the migration invisible to the UI once the Post Analytics page consumes this endpoint for its top-level email stats.

### 4. Align The Post Analytics UI If Needed

The current hook calculates top-level email stats from the post payload:

- `apps/posts/src/hooks/use-post-newsletter-stats.ts`

For the external read to be visible on the page, update the hook to prefer `usePostStats(postId)` for top-level email metrics:

- `sent` from `recipient_count`
- `opened` from `opened_count`
- `openedRate` from `open_rate`

Keep using the post response for post metadata and other existing UI needs.

Fallback in the hook can remain simple:

- if post stats are loading, show the current loading state
- if post stats are absent, use `post.email` as the local fallback

## What This Deliberately Does Not Solve

This MVP does not migrate:

- newsletter basic stats
- newsletter click stats
- newsletter average open/click comparisons
- member list email stats
- member read email stats
- filtering or sorting by email analytics fields
- top posts or site-wide analytics
- click tracking data

Those can be evaluated after the Post Analytics page proves the external read path.

## Fallback And Error Handling

For this spike:

- fail open to MySQL by default
- log external request failures
- log invalid response payloads
- keep the timeout short
- do not retry inside the Admin request
- do not cache external values separately

Recommended log context:

- post ID
- email ID
- external endpoint
- status code or timeout
- whether MySQL fallback was used

## Testing Plan

### Unit Tests

- config disabled returns existing MySQL values
- config enabled calls the external client when `email_id` exists
- external values override only `recipient_count`, `opened_count`, and `open_rate`
- member, visitor, and growth fields are unchanged
- external failure falls back to MySQL
- invalid external payload falls back to MySQL

### UI/Hook Tests

- Post Analytics hook uses post stats email metrics when available
- hook falls back to `post.email` when post stats are unavailable
- open rate formatting still matches current behavior

### Manual Verification

1. Send a test email.
2. Open the Post Analytics page.
3. Confirm current MySQL-backed values with config disabled.
4. Enable external reads against a stub service returning obviously different values.
5. Reload the Post Analytics page.
6. Confirm sent/open/open-rate values come from the external service.
7. Stop the stub service.
8. Confirm the page falls back to MySQL values.

## Recommended First Commit

Make the first implementation commit as small as possible:

1. Add config defaults.
2. Add the external post analytics client.
3. Wire `getPostStats` to optionally override email metrics.
4. Update the Post Analytics hook to read top-level email metrics from `usePostStats`.
5. Add focused tests for the backend fallback and UI selection logic.

That is enough to validate the architecture without committing to a full email analytics migration.
