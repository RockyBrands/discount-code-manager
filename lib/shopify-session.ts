import { prisma } from './prisma'
import { decryptSecret, encryptSecret } from './crypto'
import { ShopifyService } from './shopify'

export async function upsertShopToken(shopDomain: string, accessToken: string, scope?: string) {
  const encrypted = encryptSecret(accessToken)
  return prisma.shop.upsert({
    where: { shopDomain },
    create: { shopDomain, accessToken: encrypted, scope },
    update: { accessToken: encrypted, scope, uninstalledAt: null },
  })
}

export async function getShopToken(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { shopDomain } })
  if (!shop || shop.uninstalledAt) return null
  return decryptSecret(shop.accessToken)
}

export function serviceForShop(shop: { shopDomain: string; accessToken: string }) {
  return new ShopifyService(shop.shopDomain, decryptSecret(shop.accessToken))
}
