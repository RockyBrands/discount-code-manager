# Project notes

## Commands

- `npm run dev` — local dev server (needs `.env.local`)
- `npm run type-check` — TypeScript check
- `npm run build` — production build (Netlify runs `prisma generate && npm run build`)
- `npm run prisma:generate` — regenerate Prisma client after schema changes
- Function extension (`extensions/single-item-discount`): `npm install` once, then
  `npm run build` (compiles to wasm via Shopify CLI) and `npm run test` (vitest fixtures)

## Architecture

- Next.js 14 app dir + Prisma/Postgres (Netlify Database; env `NETLIFY_DB_URL`)
- Embedded Shopify app: App Bridge (CDN) issues session-token JWTs; `app/providers.tsx`
  attaches `Authorization: Bearer <token>` to same-origin `/api` fetches and bounces
  non-embedded visits through `/api/shopify/auth`. API routes call
  `getSessionOr401` from `lib/session-token.ts` (verifies HS256 JWT against
  `SHOPIFY_API_SECRET`, checks `aud`/`exp`/`dest`, and requires the shop to be
  installed). Public paths: `/api/shopify`, `/api/webhooks`, `/api/internal`.
  `middleware.ts` only forwards top-level `/?shop&hmac` hits into OAuth.
- OAuth install flow: `/api/shopify/auth` → `/api/shopify/callback`. Tokens are encrypted
  (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) and stored on `Shop` rows. Use `serviceForShop(shop)`
  from `lib/shopify-session.ts` — never read `shop.accessToken` directly.
- Cross-store redemption: `orders/create` webhook marks `DiscountCode.redeemedAt` and
  enqueues `CodeRemovalJob`s; `lib/redemption.ts#processPendingRemovals` deletes the code
  on every store (deactivates the discount when it's the last code). Runs inline after the
  webhook plus via Netlify background function `redemption-worker` and scheduled
  `redemption-sweep` (every 5 min) through `/api/internal/process-removals`
  (authed by `INTERNAL_SHARED_SECRET`).
- DB schema lives in `prisma/schema.prisma`; deploy-time SQL migrations in
  `netlify/database/migrations/` (Netlify Database applies them per deploy). Regenerate with
  `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
- `shopify.app.toml` — app config: scopes, OAuth redirect, webhook subscriptions,
  compliance webhook URIs. Replace `REPLACE_WITH_*` placeholders; use a custom app with
  Plus organization distribution.

## Discount function

`extensions/single-item-discount` — Shopify Discount Function (`cart.lines.discounts.generate.run`).
Config lives in the discount's `$app.function-configuration` JSON metafield:
`{ percentage, excludedTags, collectionIds, minimumSubtotal }`. Groups with `singleItem=true`
are created via `discountCodeAppCreate` (functionHandle `single-item-discount`);
other groups use `discountCodeBasicCreate` scoped to each shop's `collectionId`.
Update requires `shopify app deploy` from repo root after Partner Dashboard auth.

## Gotchas

- Percentage values: the Admin API expects fractions (0.5 = 50%) for basic discounts;
  the function metafield stores whole percentages (50).
- `DiscountCodeRequest.singleItem` only supports `discountType: 'percentage'`.
- Shopify admin GraphQL version: `2026-07` (`SHOPIFY_API_VERSION`).
