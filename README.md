# Shopify Coupon Code Generator

A custom web application for generating and managing Shopify coupon codes with standardized naming conventions for Rocky Brands family of companies.

## Features

### 🔐 Authentication
- Embedded Shopify app — access is gated by Shopify session tokens
- Anyone who can open the app from an installed store's admin can use it

### 🏷️ Brand & Department Management
- **Brands**: Rocky Brands, Rocky, Georgia, Durango, Muck, XTRATUF, Ranger, Lehigh Outfitters, Lehigh Safety Shoes, Slipgrips, Hard Yakka
- **Departments**: Executive (EXEC), Wholesale (WHL), Ecommerce (EC), Marketing (MKT), Customer Service (CS)

### 🎫 Coupon Code Generation
- Standardized naming format: `{DEPT_PREFIX}-{BRANCH_NAME}-{DATE}-{CUSTOM_SUFFIX}`
- Support for all Shopify discount types:
  - Percentage discounts
  - Fixed amount discounts
  - Free shipping
- Complete Shopify promotion options:
  - Minimum order requirements
  - Usage limits (total and per customer)
  - Date/time restrictions
  - Customer targeting
  - Product/collection restrictions

### 🔍 Search & Discovery
- Real-time product search
- Collection search functionality
- Product filtering by categories

### 📋 Coupon Management
- Add multiple codes to existing discounts (comma-separated)
- Remove codes from existing discounts
- Bulk operations similar to Matrixify

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Shopify Partner app (custom app with Plus organization distribution)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shopify-coupon-code-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
   
   See `.env.local.example` for the full list. Key values:
   ```env
   # Database (Netlify Database / Postgres)
   NETLIFY_DB_URL=postgresql://user:pass@host/db

   # Shopify app (Partner Dashboard)
   SHOPIFY_API_KEY=your-shopify-app-client-id
   SHOPIFY_API_SECRET=your-shopify-app-client-secret
   APP_URL=http://localhost:3000
   TOKEN_ENCRYPTION_KEY=   # base64 32-byte key
   INTERNAL_SHARED_SECRET= # random hex
   ```

   No separate staff sign-in is needed — the app is embedded in Shopify admin
   and authenticates users via Shopify session tokens.

### Shopify Setup

1. **Create a Private App in Shopify**
   - Go to Shopify Admin → Apps and sales channels → Develop apps
   - Create app with Admin API access
   - Enable these permissions:
     - `read_products`
     - `read_discounts`
     - `write_discounts`
     - `read_customers`

2. **Get Admin API Access Token**
   - Install the app and copy the Admin API access token
   - Add to your `.env.local` file

### Development

The app is embedded in Shopify admin, so local development runs through the
Shopify CLI (it tunnels and keeps `shopify.app.toml` URLs in sync):

```bash
shopify app dev
```

Then open the app from a dev store's admin → Apps. Plain `npm run dev` still
works for editing UI, but page loads require `?shop=<store>` params and API
calls require a session token, so the admin-embedded path is the one to use.

## Deployment

### Shopify app setup (once)

1. In the Partner Dashboard create an app, set distribution to **custom app for your Plus organization** (allows install on all brand stores in the org).
2. Copy the app's client ID/secret into `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`.
3. In `shopify.app.toml`, replace `REPLACE_WITH_CLIENT_ID` and `REPLACE_WITH_NETLIFY_URL` placeholders.
4. From the repo root run `shopify app deploy` to release the discount function (`extensions/single-item-discount`).

### Netlify

1. Connect the repo as a Netlify site (build: `prisma generate && npm run build`, publish: `.next`, plugin `@netlify/plugin-nextjs` — all in `netlify.toml`).
2. `@netlify/database` is installed, so Netlify provisions a Postgres database automatically. The schema applies via `netlify/database/migrations/` on each deploy; `NETLIFY_DB_URL` is injected at build and runtime.
3. Set env vars: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL`, `TOKEN_ENCRYPTION_KEY`, `INTERNAL_SHARED_SECRET`. (`NETLIFY_DB_URL` is injected by `@netlify/database`.)
4. In Partner Dashboard, request access to **protected customer data** (required for `orders/create` webhooks).
5. Install on each brand store via `/api/shopify/auth?shop=<store>.myshopify.com`. On install, each store's offline token is saved; the `orders/create` webhook marks redeemed codes and removes them from the other stores automatically.

### Single-item discounts

Groups created with **Single Item Mode** (percentage only) are backed by the deployed
discount function instead of a basic Shopify discount: the configured percentage is
applied to the most expensive eligible item in the cart (`quantity: 1`), skipping
products carrying any of the group's excluded tags.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── coupons/       # Coupon management
│   │   ├── products/      # Product search
│   │   └── collections/   # Collection search
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── coupon-generator.tsx
│   └── coupon-manager.tsx
├── lib/                  # Utility libraries
│   ├── shopify.ts        # Shopify API integration
│   ├── types.ts          # TypeScript definitions
│   ├── constants.ts       # App constants
│   └── utils.ts          # Helper functions
└── public/               # Static assets
```

## Usage

### Generating New Coupons

1. **Select Brand & Department**
   - Choose from the dropdown menus
   - Preview shows the code format

2. **Configure Discount**
   - Set discount type and value
   - Configure restrictions and limits
   - Set date ranges if needed

3. **Target Products/Collections**
   - Search and select specific products
   - Or choose entire collections
   - Leave blank for all products

4. **Generate & Create**
   - Review the preview
   - Click generate to create in Shopify

### Managing Existing Coupons

1. **Add Codes**
   - Enter comma-separated codes
   - Click "Add Codes" to add to existing discount

2. **Remove Codes**
   - Enter codes to remove
   - Click "Remove Codes" to delete from discount

3. **Update Restrictions**
   - Modify product/collection targeting
   - Update discount parameters

## Security

- Shopify session-token verification on all app API routes (`lib/session-token.ts`)
- Shop access tokens encrypted at rest (AES-256-GCM)
- HTTPS required for production
- Environment variable protection

## Support

For issues and questions:
1. Check the console for error messages
2. Verify Shopify API permissions
3. Confirm environment variables are set correctly
4. Open the app from a store's Shopify admin (it's an embedded app)

## License

Internal use only - Rocky Brands family of companies.
