export function brandIdFromShopDomain(shopDomain?: string) {
  if (!shopDomain) return undefined
  const shop = shopDomain.toLowerCase()

  const mapping: Record<string, string> = {
    'stg-georgiaboot.myshopify.com': 'georgia',
  }

  return mapping[shop]
}
