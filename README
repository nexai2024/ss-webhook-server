# Endpoint Builders

Build, inspect, and manage webhook endpoints — unlimited and developer-first.

**Domain:** [endpoint.builders](https://endpoint.builders)

## Deploy your own

Deploy using [Vercel](https://vercel.com) with your MongoDB, Clerk, and Resend credentials.

## Instructions

1. Copy `.env.example` to `.env` / `.env.local` and fill in values (Clerk, MongoDB, Resend).

```sh
cp .env.example .env
```

See `.env.example` for all required variables. In production you must set `MONGODB_URI`, Clerk live keys, `RESEND_API_KEY`, and a verified `RESEND_FROM` address.

## Clerk Billing

Billing is enabled for users on the linked **Endpoint Builders** Clerk app.

| Plan slug | Features (entitlements) |
|-----------|-------------------------|
| `free_user` | `2_endpoints`, `standard_http_200_201_204_responses` |
| `cloud_premium` | `_unlimited_cloud_endpoints`, `custom_error_statuses_4xx_5xx_etc_`, `instant_resend_react_email_alerts`, `zero_hosting_or_db_maintenance` |

Server gates use `has({ plan: 'cloud_premium' })` / the feature slugs above (see `app/lib/billing.ts`).

```sh
npx clerk auth login
npx clerk link --app app_3301R6yZxYJ4BbA6D2CeQVVEg42
npx clerk enable billing --for users --yes
# Pull / push plan catalog:
npx clerk config pull --keys billing --output clerk/billing.json
npx clerk config patch --file clerk/billing.json --yes
```

Optional: register `https://<domain>/api/clerk/webhooks` in Clerk Dashboard → Webhooks and set `CLERK_WEBHOOK_SIGNING_SECRET`.

Visit `/pricing` — `<PricingTable />` opens Clerk’s checkout drawer.

2. Install dependencies:

```sh
npm install
# or
pnpm install
```

3. Run Next.js locally:

```sh
npm run dev
```

4. Run React Email locally (optional):

```sh
npm run email
```

## License

MIT License
