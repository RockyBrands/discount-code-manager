import { createAdminApiClient } from '@shopify/admin-api-client'
import { DiscountCodeRequest, ShopifyProduct, ShopifyCollection } from './types'

export const SINGLE_ITEM_FUNCTION_HANDLE = 'single-item-discount'
export const FUNCTION_CONFIG_METAFIELD = { namespace: '$app', key: 'function-configuration' }

export class ShopifyService {
  private shopDomain: string
  private accessToken: string
  private apiVersion: string

  constructor(shopDomain: string, accessToken: string, apiVersion: string = '2026-07') {
    this.shopDomain = shopDomain
    this.accessToken = accessToken
    this.apiVersion = apiVersion
  }

  private getClient() {
    const client = createAdminApiClient({
      storeDomain: this.shopDomain,
      apiVersion: this.apiVersion,
      accessToken: this.accessToken,
    })

    if (process.env.DEBUG_SHOPIFY === 'true') {
      console.log('Shopify client created with domain:', this.shopDomain, 'and version:', this.apiVersion)
      console.log('API URL:', client.getApiUrl())
    }

    return client
  }

  private normalizeDateTime(value?: string) {
    if (!value) return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed.toISOString()
  }

  private toDecimalString(value: number) {
    return value.toFixed(2)
  }

  private buildDiscountValue(discountCode: DiscountCodeRequest) {
    if (discountCode.discountType === 'percentage') {
      // Shopify expects a decimal fraction (e.g. 0.5 for 50%)
      return { percentage: discountCode.discountValue / 100 }
    }
    if (discountCode.discountType === 'fixed_amount') {
      return {
        discountAmount: {
          amount: this.toDecimalString(discountCode.discountValue),
          appliesOnEachItem: false,
        },
      }
    }
    return { percentage: 0 }
  }

  private buildCustomerSelection(discountCode: DiscountCodeRequest) {
    return discountCode.customerSelection === 'prerequisite' && discountCode.prerequisiteCustomerIds?.length
      ? { customers: { add: discountCode.prerequisiteCustomerIds } }
      : { all: true }
  }

  private buildMinimumRequirement(discountCode: DiscountCodeRequest) {
    return typeof discountCode.minimumOrderAmount === 'number'
      ? {
          subtotal: {
            greaterThanOrEqualToSubtotal: this.toDecimalString(discountCode.minimumOrderAmount),
          },
        }
      : undefined
  }

  private buildCombinesWith(discountCode: DiscountCodeRequest) {
    return discountCode.combinesWith || {
      productDiscounts: false,
      orderDiscounts: false,
      shippingDiscounts: false,
    }
  }

  private buildAppDiscountConfig(discountCode: DiscountCodeRequest) {
    return {
      percentage: discountCode.discountValue,
      excludedTags: (discountCode.excludedTags || []).map(t => t.trim()).filter(Boolean),
      minimumSubtotal: typeof discountCode.minimumOrderAmount === 'number' ? discountCode.minimumOrderAmount : null,
      collectionIds: discountCode.appliesToCollections || [],
    }
  }

  private async getShopCurrencyCode() {
    const client = this.getClient()
    const response = await client.request(`query { shop { currencyCode } }`)
    const currencyCode = response.data?.shop?.currencyCode
    if (!currencyCode) {
      throw new Error('Unable to determine shop currencyCode')
    }
    return currencyCode as string
  }

  async createDiscountCode(discountCode: DiscountCodeRequest) {
    const client = this.getClient()
    
    try {
      const startsAt = this.normalizeDateTime(discountCode.startsAt) || new Date().toISOString()
      const endsAt = this.normalizeDateTime(discountCode.endsAt)
      const appliesOncePerCustomer = discountCode.usageLimitPerCustomer === 1

      const combinesWith = discountCode.combinesWith || {
        productDiscounts: false,
        orderDiscounts: false,
        shippingDiscounts: false,
      }

      const customerSelection =
        discountCode.customerSelection === 'prerequisite' && discountCode.prerequisiteCustomerIds?.length
          ? { customers: { add: discountCode.prerequisiteCustomerIds } }
          : { all: true }

      const items = (() => {
        if (discountCode.appliesTo === 'product' && discountCode.appliesToProducts?.length) {
          return { products: { productsToAdd: discountCode.appliesToProducts } }
        }
        if (discountCode.appliesTo === 'collection' && discountCode.appliesToCollections?.length) {
          return { collections: { add: discountCode.appliesToCollections } }
        }
        return { all: true }
      })()

      const value = this.buildDiscountValue(discountCode)

      const minimumRequirement =
        typeof discountCode.minimumOrderAmount === 'number'
          ? {
              subtotal: {
                greaterThanOrEqualToSubtotal: this.toDecimalString(discountCode.minimumOrderAmount),
              },
            }
          : undefined

      const basicCodeDiscount = {
        title: discountCode.code,
        code: discountCode.code,
        startsAt,
        ...(endsAt ? { endsAt } : {}),
        customerSelection,
        customerGets: {
          items,
          value,
        },
        ...(typeof discountCode.usageLimit === 'number' ? { usageLimit: discountCode.usageLimit } : {}),
        appliesOncePerCustomer,
        combinesWith,
        ...(minimumRequirement ? { minimumRequirement } : {}),
      }

      const response = await client.request(
        `mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { basicCodeDiscount } }
      )

      if (!response.data) {
        throw new Error('No data in response: ' + JSON.stringify(response))
      }

      const payload = response.data.discountCodeBasicCreate
      const userErrors = payload?.userErrors || []
      if (userErrors.length) {
        throw new Error(userErrors.map((e: any) => e.message).join('; '))
      }

      return payload
    } catch (error) {
      console.error('Error creating discount code:', error)
      throw error
    }
  }

  async getDiscountCodes(limit = 50) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query codeDiscountNodes($first: Int!) {
          codeDiscountNodes(first: $first) {
            nodes {
              id
            }
          }
        }`,
        { variables: { first: limit } }
      )

      return response.data?.codeDiscountNodes
    } catch (error) {
      console.error('Error fetching discount codes:', error)
      throw error
    }
  }

  async getDiscountCode(id: string) {
    const client = this.getClient()

    try {
      const response = await client.request(
        `query discountNode($id: ID!) {
          discountNode(id: $id) {
            id
          }
        }`,
        { variables: { id } }
      )

      return response.data?.discountNode
    } catch (error) {
      console.error('Error fetching discount code:', error)
      throw error
    }
  }

  async addCodesToDiscount(discountId: string, codes: string[]) {
    throw new Error('Not implemented')
  }

  async removeCodesFromDiscount(discountId: string, codes: string[]) {
    throw new Error('Not implemented')
  }

  async searchProducts(query: string, limit = 25) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query products($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            nodes {
              id
              title
              handle
              status
              vendor
              productType
              createdAt
              updatedAt
              tags
              variants(first: 50) {
                nodes {
                  id
                  title
                  price
                  sku
                }
              }
            }
          }
        }`,
        { variables: { first: limit, query: query || undefined } }
      )

      return (response.data?.products?.nodes || []) as ShopifyProduct[]
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  }

  async getProduct(id: string) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query product($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            status
            vendor
            productType
            createdAt
            updatedAt
            tags
            variants(first: 50) {
              nodes {
                id
                title
                price
                sku
              }
            }
          }
        }`,
        { variables: { id } }
      )

      return response.data?.product as ShopifyProduct
    } catch (error) {
      console.error('Error fetching product:', error)
      throw error
    }
  }

  async searchCollections(query: string, limit = 25) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query collections($first: Int!, $query: String) {
          collections(first: $first, query: $query) {
            nodes {
              id
              title
              handle
              updatedAt
              description
            }
          }
        }`,
        { variables: { first: limit, query: query || undefined } }
      )

      return (response.data?.collections?.nodes || []) as ShopifyCollection[]
    } catch (error) {
      console.error('Error searching collections:', error)
      throw error
    }
  }

  async getCollection(id: string) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query collection($id: ID!) {
          collection(id: $id) {
            id
            title
            handle
            updatedAt
            description
          }
        }`,
        { variables: { id } }
      )

      return response.data?.collection as ShopifyCollection
    } catch (error) {
      console.error('Error fetching collection:', error)
      throw error
    }
  }

  async getProductsByCollection(collectionId: string, limit = 50) {
    const client = this.getClient()
    
    try {
      const response = await client.request(
        `query collectionProducts($id: ID!, $first: Int!) {
          collection(id: $id) {
            products(first: $first) {
              nodes {
                id
                title
                handle
                status
                vendor
                productType
                createdAt
                updatedAt
                tags
                variants(first: 50) {
                  nodes {
                    id
                    title
                    price
                    sku
                  }
                }
              }
            }
          }
        }`,
        { variables: { id: collectionId, first: limit } }
      )

      return (response.data?.collection?.products?.nodes || []) as ShopifyProduct[]
    } catch (error) {
      console.error('Error fetching products by collection:', error)
      throw error
    }
  }

  private buildBasicCodeDiscount(title: string, code: string | undefined, discountCode: DiscountCodeRequest, collectionId: string) {
    const startsAt = this.normalizeDateTime(discountCode.startsAt) || new Date().toISOString()
    const endsAt = this.normalizeDateTime(discountCode.endsAt)

    if (discountCode.discountType !== 'percentage' && discountCode.discountType !== 'fixed_amount') {
      throw new Error('Unsupported discount type for group discount')
    }

    const minimumRequirement = this.buildMinimumRequirement(discountCode)

    return {
      title,
      ...(code ? { code } : {}),
      startsAt,
      ...(endsAt ? { endsAt } : {}),
      customerSelection: this.buildCustomerSelection(discountCode),
      customerGets: {
        items: { collections: { add: [collectionId] } },
        value: this.buildDiscountValue(discountCode),
      },
      usageLimit: 1,
      appliesOncePerCustomer: true,
      combinesWith: this.buildCombinesWith(discountCode),
      ...(minimumRequirement ? { minimumRequirement } : {}),
    }
  }

  private buildAppCodeDiscount(title: string, code: string | undefined, discountCode: DiscountCodeRequest, collectionId?: string) {
    if (discountCode.discountType !== 'percentage') {
      throw new Error('Single-item discounts only support a percentage value')
    }
    const startsAt = this.normalizeDateTime(discountCode.startsAt) || new Date().toISOString()
    const endsAt = this.normalizeDateTime(discountCode.endsAt)
    const config = { ...this.buildAppDiscountConfig(discountCode), collectionIds: collectionId ? [collectionId] : [] }

    return {
      title,
      ...(code ? { code } : {}),
      startsAt,
      ...(endsAt ? { endsAt } : {}),
      functionHandle: SINGLE_ITEM_FUNCTION_HANDLE,
      discountClasses: ['PRODUCT'],
      customerSelection: this.buildCustomerSelection(discountCode),
      combinesWith: this.buildCombinesWith(discountCode),
      usageLimit: 1,
      appliesOncePerCustomer: true,
      metafields: [
        {
          namespace: '$app',
          key: 'function-configuration',
          type: 'json',
          value: JSON.stringify(config),
        },
      ],
    }
  }

  async createGroupDiscount(title: string, discountCode: DiscountCodeRequest, codes: string[], collectionId?: string) {
    if (codes.length === 0) throw new Error('At least one code is required')
    if (!discountCode.singleItem && !collectionId) throw new Error('Collection ID is required')

    const client = this.getClient()

    if (discountCode.singleItem) {
      const codeAppDiscount = this.buildAppCodeDiscount(title, codes[0], discountCode, collectionId)
      const response = await client.request(
        `mutation discountCodeAppCreate($codeAppDiscount: DiscountCodeAppInput!) {
          discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
            codeAppDiscount {
              discountId
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { codeAppDiscount } }
      )

      const payload = response.data?.discountCodeAppCreate
      const userErrors = payload?.userErrors || []
      if (userErrors.length) {
        throw new Error(userErrors.map((e: any) => e.message).join('; '))
      }

      const discountNodeId = payload?.codeAppDiscount?.discountId as string
      if (codes.length > 1) {
        await this.addRedeemCodes(discountNodeId, codes.slice(1))
      }
      return discountNodeId
    }

    const basicCodeDiscount = this.buildBasicCodeDiscount(title, codes[0], discountCode, collectionId as string)
    const response = await client.request(
      `mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { basicCodeDiscount } }
    )

    const payload = response.data?.discountCodeBasicCreate
    const userErrors = payload?.userErrors || []
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join('; '))
    }

    const discountNodeId = payload?.codeDiscountNode?.id as string
    if (codes.length > 1) {
      await this.addRedeemCodes(discountNodeId, codes.slice(1))
    }

    return discountNodeId
  }

  async addRedeemCodes(discountNodeId: string, codes: string[]) {
    if (codes.length === 0) return null
    const client = this.getClient()
    const chunks = []
    for (let i = 0; i < codes.length; i += 250) {
      chunks.push(codes.slice(i, i + 250))
    }

    const results = []
    for (const chunk of chunks) {
      const response = await client.request(
        `mutation discountRedeemCodeBulkAdd($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
          discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
            bulkCreation {
              id
            }
            userErrors {
              code
              field
              message
            }
          }
        }`,
        { variables: { discountId: discountNodeId, codes: chunk.map(code => ({ code })) } }
      )

      const payload = response.data?.discountRedeemCodeBulkAdd
      if (payload?.userErrors?.length) {
        throw new Error(payload.userErrors.map((e: any) => e.message).join('; '))
      }

      const bulkCreationId = payload?.bulkCreation?.id as string
      await this.pollBulkRedeemCreation(bulkCreationId)
      results.push(bulkCreationId)
    }

    return results
  }

  private async pollBulkRedeemCreation(bulkCreationId: string, maxTries = 30) {
    const client = this.getClient()
    for (let i = 0; i < maxTries; i++) {
      const response = await client.request(
        `query discountRedeemCodeBulkCreation($id: ID!) {
          discountRedeemCodeBulkCreation(id: $id) {
            done
            importedCount
            failedCount
            codes(first: 10) { nodes { code errors { message } } }
          }
        }`,
        { variables: { id: bulkCreationId } }
      )

      const creation = response.data?.discountRedeemCodeBulkCreation
      if (creation?.done) {
        if (creation.failedCount > 0) {
          const details = (creation.codes?.nodes || [])
            .flatMap((c: any) => (c.errors || []).map((e: any) => `${c.code}: ${e.message}`))
            .join('; ')
          throw new Error(details || `Bulk code creation failed (${creation.failedCount} codes)`)
        }
        return creation
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error('Timed out waiting for bulk code creation')
  }

  async getDiscountNodeType(id: string) {
    const client = this.getClient()
    const response = await client.request(
      `query discountNode($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            __typename
          }
        }
      }`,
      { variables: { id } }
    )

    return (response.data?.discountNode?.discount as any)?.__typename as string | undefined
  }

  private async findRedeemCode(discountNodeId: string, code: string) {
    const client = this.getClient()
    const wanted = code.trim().toUpperCase()
    let cursor: string | null = null

    for (let page = 0; page < 40; page++) {
      const response = await client.request(
        `query discountRedeemCodes($id: ID!, $after: String) {
          discountNode(id: $id) {
            discount {
              __typename
              ... on DiscountCodeBasic {
                codesCount { count }
                codes(first: 250, after: $after) {
                  pageInfo { hasNextPage endCursor }
                  nodes { id code }
                }
              }
              ... on DiscountCodeApp {
                codesCount { count }
                codes(first: 250, after: $after) {
                  pageInfo { hasNextPage endCursor }
                  nodes { id code }
                }
              }
            }
          }
        }`,
        { variables: { id: discountNodeId, after: cursor } }
      )

      const discount = response.data?.discountNode?.discount as any
      if (!discount) return { count: 0, codeId: null }

      const codes = discount.codes
      const match = (codes?.nodes || []).find((c: any) => c.code?.toUpperCase() === wanted)
      if (match) {
        return { count: discount.codesCount?.count ?? 0, codeId: match.id as string }
      }
      if (!codes?.pageInfo?.hasNextPage) {
        return { count: discount.codesCount?.count ?? 0, codeId: null }
      }
      cursor = codes.pageInfo.endCursor
    }

    throw new Error('Too many pages while looking up discount code')
  }

  private async deactivateDiscountNode(discountNodeId: string) {
    const client = this.getClient()
    const response = await client.request(
      `mutation discountCodeDeactivate($id: ID!) {
        discountCodeDeactivate(id: $id) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`,
      { variables: { id: discountNodeId } }
    )

    const userErrors = response.data?.discountCodeDeactivate?.userErrors || []
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join('; '))
    }
    return { deactivated: true }
  }

  async removeRedeemCode(discountNodeId: string, code: string) {
    const { count, codeId } = await this.findRedeemCode(discountNodeId, code)
    if (!codeId) return null

    // A discount must keep at least one code; retire the whole discount instead.
    if (count <= 1) {
      return this.deactivateDiscountNode(discountNodeId)
    }

    const client = this.getClient()
    const response = await client.request(
      `mutation discountCodeRedeemCodeBulkDelete($discountId: ID!, $ids: [ID!]) {
        discountCodeRedeemCodeBulkDelete(discountId: $discountId, ids: $ids) {
          job {
            id
          }
          userErrors {
            code
            field
            message
          }
        }
      }`,
      { variables: { discountId: discountNodeId, ids: [codeId] } }
    )

    const userErrors = response.data?.discountCodeRedeemCodeBulkDelete?.userErrors || []
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join('; '))
    }

    return response.data?.discountCodeRedeemCodeBulkDelete
  }

  async updateGroupDiscount(nodeId: string, discountCode: DiscountCodeRequest, codes: string[], collectionId: string | undefined, title: string) {
    const wantsAppDiscount = !!discountCode.singleItem
    const nodeType = await this.getDiscountNodeType(nodeId)
    const isAppDiscount = nodeType === 'DiscountCodeApp'

    if (wantsAppDiscount !== isAppDiscount) {
      await this.deleteDiscountCodeNode(nodeId)
      return { nodeId: await this.createGroupDiscount(title, discountCode, codes, collectionId), recreated: true }
    }

    const client = this.getClient()

    if (wantsAppDiscount) {
      const codeAppDiscount = this.buildAppCodeDiscount(title, undefined, discountCode, collectionId)
      const response = await client.request(
        `mutation discountCodeAppUpdate($id: ID!, $codeAppDiscount: DiscountCodeAppInput!) {
          discountCodeAppUpdate(id: $id, codeAppDiscount: $codeAppDiscount) {
            codeAppDiscount {
              discountId
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { id: nodeId, codeAppDiscount } }
      )

      const userErrors = response.data?.discountCodeAppUpdate?.userErrors || []
      if (userErrors.length) {
        throw new Error(userErrors.map((e: any) => e.message).join('; '))
      }

      return { nodeId, recreated: false }
    }

    const basicCodeDiscount = this.buildBasicCodeDiscount(title, undefined, discountCode, collectionId as string)
    const response = await client.request(
      `mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: nodeId, basicCodeDiscount } }
    )

    const userErrors = response.data?.discountCodeBasicUpdate?.userErrors || []
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join('; '))
    }

    return { nodeId, recreated: false }
  }

  async deleteDiscountCodeNode(nodeId: string) {
    const client = this.getClient()
    const response = await client.request(
      `mutation discountCodeDelete($id: ID!) {
        discountCodeDelete(id: $id) {
          deletedCodeDiscountId
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: nodeId } }
    )

    const userErrors = response.data?.discountCodeDelete?.userErrors || []
    if (userErrors.length) {
      throw new Error(userErrors.map((e: any) => e.message).join('; '))
    }

    return response.data?.discountCodeDelete?.deletedCodeDiscountId
  }
}

export function createShopifyService(brandId?: string) {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'
  
  // Map brand IDs to environment variable names
  const brandConfig: Record<string, { domain: string; token: string }> = {
    'rocky': {
      domain: process.env.SHOPIFY_ROCKY_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_ROCKY_ACCESS_TOKEN || '',
    },
    'georgia': {
      domain: process.env.SHOPIFY_GEORGIA_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_GEORGIA_ACCESS_TOKEN || '',
    },
    'durango': {
      domain: process.env.SHOPIFY_DURANGO_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_DURANGO_ACCESS_TOKEN || '',
    },
    'muck': {
      domain: process.env.SHOPIFY_MUCK_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_MUCK_ACCESS_TOKEN || '',
    },
    'xtratuf': {
      domain: process.env.SHOPIFY_XTRATUF_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_XTRATUF_ACCESS_TOKEN || '',
    },
    'ranger': {
      domain: process.env.SHOPIFY_RANGER_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_RANGER_ACCESS_TOKEN || '',
    },
    'lehigh-outfitters': {
      domain: process.env.SHOPIFY_LEHIGH_OUTFITTERS_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_LEHIGH_OUTFITTERS_ACCESS_TOKEN || '',
    },
    'lehigh-safety-shoes': {
      domain: process.env.SHOPIFY_LEHIGH_SAFETY_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_LEHIGH_SAFETY_ACCESS_TOKEN || '',
    },
    'slipgrips': {
      domain: process.env.SHOPIFY_SLIPGRIPS_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_SLIPGRIPS_ACCESS_TOKEN || '',
    },
    'hard-yakka': {
      domain: process.env.SHOPIFY_HARD_YAKKA_SHOP_DOMAIN || '',
      token: process.env.SHOPIFY_HARD_YAKKA_ACCESS_TOKEN || '',
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
