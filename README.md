# Shopify Coupon Code Generator

A custom web application for generating and managing Shopify coupon codes with standardized naming conventions for Rocky Brands family of companies.

## Features

### 🔐 Authentication
- Google OAuth integration with domain restrictions
- Authorized domains: `@rockybrands.com`, `@lehigh.com`, `@lehighoutfitters.com`

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
- Shopify store with Admin API access
- Google OAuth credentials

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
   
   Configure the following environment variables:
   ```env
   # Shopify Configuration
   SHOPIFY_SHOP_DOMAIN=your-shop-domain.myshopify.com
   SHOPIFY_API_VERSION=2024-01
   SHOPIFY_ACCESS_TOKEN=your-admin-api-access-token

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret

   # Allowed domains for authentication
   ALLOWED_DOMAINS=rockybrands.com,lehigh.com,lehighoutfitters.com
   ```

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

### Google OAuth Setup

1. **Create Google Cloud Project**
   - Go to Google Cloud Console
   - Create new project or use existing one

2. **Configure OAuth 2.0 Credentials**
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Add authorized domains for production

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Render.com Deployment

1. **Create Render Account**
   - Sign up at [render.com](https://render.com)

2. **Connect Repository**
   - Connect your GitHub repository
   - Configure as a Web Service

3. **Environment Variables**
   - Add all environment variables from `.env.local`
   - Set `NEXTAUTH_URL` to your Render domain

4. **Build Configuration**
   - Build command: `npm run build`
   - Start command: `npm start`

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── coupons/       # Coupon management
│   │   ├── products/      # Product search
│   │   └── collections/   # Collection search
│   ├── auth/              # Authentication pages
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

- Domain-restricted authentication
- Secure API token handling
- HTTPS required for production
- Environment variable protection

## Support

For issues and questions:
1. Check the console for error messages
2. Verify Shopify API permissions
3. Confirm environment variables are set correctly
4. Ensure Google OAuth is properly configured

## License

Internal use only - Rocky Brands family of companies.
