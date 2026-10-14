# ADR 0001 — Foundation runtime versions

**Status:** Accepted for Milestone 0

Nib Atlas uses Next.js 16.2.6 rather than 16.3.0 for the first Cloudflare foundation. At the time of implementation, open upstream reports described Next.js 16.3 regressions in the OpenNext Cloudflare path. This is an implementation pin, not a permanent product constraint.

The adapter is `@opennextjs/cloudflare` 1.20.2. Upgrade Next.js only through a dedicated dependency PR that passes the standard Next.js build, OpenNext build, and Playwright smoke tests.
