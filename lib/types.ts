export interface Brand {
  id: string
  name: string
  displayName: string
  hasShopifyStore: boolean
}

export interface Department {
  id: string
  name: string
  prefix: string
  displayName: string
}

export interface CouponCode {
  id: string
  code: string
  brand: Brand
  department: Department
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping'
  discountValue: number
  minimumOrderAmount?: number
  usageLimit?: number
  usageLimitPerCustomer?: number
  startsAt?: Date
  endsAt?: Date
  appliesToResource?: 'product' | 'collection' | 'all'
  appliesToId?: string
  appliesToIds?: string[]
  customerSelection?: 'all' | 'prerequisite'
  prerequisiteCustomerIds?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ShopifyProduct {
  id: string
  title: string
  handle: string
  status: string
  vendor: string
  productType: string
  createdAt: string
  updatedAt: string
  tags: string[]
  variants: Array<{
    id: string
    title: string
    price: string
    sku: string
  }>
}

export interface ShopifyCollection {
  id: string
  title: string
  handle: string
  publishedAt: string
  updatedAt: string
}

export interface DiscountCodeRequest {
  code: string
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping'
  discountValue: number
  combinesWith?: {
    orderDiscounts: boolean
    productDiscounts: boolean
    shippingDiscounts: boolean
  }
  startsAt?: string
  endsAt?: string
  minimumRequirement?: {
    quantity?: number
    subtotal?: number
  }
  usageLimit?: number
  usageLimitPerCustomer?: number
  customerSelection?: 'all' | 'prerequisite'
  prerequisiteCustomerIds?: string[]
  appliesToOneTimePurchase?: boolean
  appliesToSubscription?: boolean
  appliesToProducts?: string[]
  appliesToCollections?: string[]
  appliesToProductVariants?: string[]
}

export interface User {
  id: string
  email: string
  name: string
  domain: string
}
