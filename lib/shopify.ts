import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api'
import { DiscountCodeRequest, ShopifyProduct, ShopifyCollection } from './types'

export class ShopifyService {
  private shopDomain: string
  private accessToken: string
  private apiVersion: string

  constructor(shopDomain: string, accessToken: string, apiVersion: string = '2024-01') {
    this.shopDomain = shopDomain
    this.accessToken = accessToken
    this.apiVersion = apiVersion
  }

  private getClient() {
    const shopify = shopifyApi({
      apiVersion: this.apiVersion as any,
    })

    return new shopify.clients.Rest({
      session: {
        shop: this.shopDomain,
        accessToken: this.accessToken,
        id: 'session-id',
        state: 'active',
        isOnline: true as any,
        isActive: true as any,
        scope: 'read_products,read_discounts,write_discounts,read_customers',
      },
    })
  }

  async createDiscountCode(discountCode: DiscountCodeRequest) {
    const client = this.getClient()
    
    try {
      const response = await client.post({
        path: 'discount_codes',
        data: {
          discount_code: discountCode,
        },
      })
      
      return response.body
    } catch (error) {
      console.error('Error creating discount code:', error)
      throw error
    }
  }

  async getDiscountCodes(limit = 50) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: 'discount_codes',
        query: { limit },
      })
      
      return response.body
    } catch (error) {
      console.error('Error fetching discount codes:', error)
      throw error
    }
  }

  async getDiscountCode(id: string) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: `discount_codes/${id}`,
      })
      
      return response.body
    } catch (error) {
      console.error('Error fetching discount code:', error)
      throw error
    }
  }

  async addCodesToDiscount(discountId: string, codes: string[]) {
    const client = this.getClient()
    
    try {
      const response = await client.post({
        path: `discount_codes/${discountId}/codes`,
        data: {
          codes: codes.map(code => ({ code })),
        },
      })
      
      return response.body
    } catch (error) {
      console.error('Error adding codes to discount:', error)
      throw error
    }
  }

  async removeCodesFromDiscount(discountId: string, codes: string[]) {
    const client = this.getClient()
    
    try {
      const response = await client.delete({
        path: `discount_codes/${discountId}/codes`,
        query: { codes: codes.join(',') },
      })
      
      return response.body
    } catch (error) {
      console.error('Error removing codes from discount:', error)
      throw error
    }
  }

  async searchProducts(query: string, limit = 25) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: 'products',
        query: { 
          limit,
          ...(query && { title: query }),
        },
      })
      
      return response.body.products as ShopifyProduct[]
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  }

  async getProduct(id: string) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: `products/${id}`,
      })
      
      return response.body.product as ShopifyProduct
    } catch (error) {
      console.error('Error fetching product:', error)
      throw error
    }
  }

  async searchCollections(query: string, limit = 25) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: 'custom_collections',
        query: { 
          limit,
          ...(query && { title: query }),
        },
      })
      
      return response.body.custom_collections as ShopifyCollection[]
    } catch (error) {
      console.error('Error searching collections:', error)
      throw error
    }
  }

  async getCollection(id: string) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: `custom_collections/${id}`,
      })
      
      return response.body.custom_collection as ShopifyCollection
    } catch (error) {
      console.error('Error fetching collection:', error)
      throw error
    }
  }

  async getProductsByCollection(collectionId: string, limit = 50) {
    const client = this.getClient()
    
    try {
      const response = await client.get({
        path: 'products',
        query: { 
          limit,
          collection_id: collectionId,
        },
      })
      
      return response.body.products as ShopifyProduct[]
    } catch (error) {
      console.error('Error fetching products by collection:', error)
      throw error
    }
  }
}

export function createShopifyService(brandId?: string) {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01'
  
  // Map brand IDs to environment variable names
  const brandConfig: Record<string, { domain: string; token: string }> = {
    'rocky': {
      domain: process.env.SHOPIFY_ROCKY_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_ROCKY_ACCESS_TOKEN!,
    },
    'georgia': {
      domain: process.env.SHOPIFY_GEORGIA_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_GEORGIA_ACCESS_TOKEN!,
    },
    'durango': {
      domain: process.env.SHOPIFY_DURANGO_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_DURANGO_ACCESS_TOKEN!,
    },
    'muck': {
      domain: process.env.SHOPIFY_MUCK_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_MUCK_ACCESS_TOKEN!,
    },
    'xtratuf': {
      domain: process.env.SHOPIFY_XTRATUF_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_XTRATUF_ACCESS_TOKEN!,
    },
    'ranger': {
      domain: process.env.SHOPIFY_RANGER_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_RANGER_ACCESS_TOKEN!,
    },
    'lehigh-outfitters': {
      domain: process.env.SHOPIFY_LEHIGH_OUTFITTERS_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_LEHIGH_OUTFITTERS_ACCESS_TOKEN!,
    },
    'lehigh-safety-shoes': {
      domain: process.env.SHOPIFY_LEHIGH_SAFETY_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_LEHIGH_SAFETY_ACCESS_TOKEN!,
    },
    'slipgrips': {
      domain: process.env.SHOPIFY_SLIPGRIPS_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_SLIPGRIPS_ACCESS_TOKEN!,
    },
    'hard-yakka': {
      domain: process.env.SHOPIFY_HARD_YAKKA_SHOP_DOMAIN!,
      token: process.env.SHOPIFY_HARD_YAKKA_ACCESS_TOKEN!,
    },
  }

  // Fallback to single store configuration for backward compatibility
  if (!brandId || !brandConfig[brandId]) {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

    if (!shopDomain || !accessToken) {
      throw new Error('Shopify credentials not configured for brand: ' + (brandId || 'default'))
    }

    return new ShopifyService(shopDomain, accessToken, apiVersion)
  }

  const config = brandConfig[brandId]
  if (!config.domain || !config.token) {
    throw new Error(`Shopify credentials not configured for brand: ${brandId}`)
  }

  return new ShopifyService(config.domain, config.token, apiVersion)
}
