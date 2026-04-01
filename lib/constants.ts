import { Brand, Department } from './types'

export const BRANDS: Brand[] = [
  { id: 'rocky-brands', name: 'Rocky Brands', displayName: 'Rocky Brands', hasShopifyStore: false },
  { id: 'rocky', name: 'Rocky', displayName: 'Rocky', hasShopifyStore: true },
  { id: 'georgia', name: 'Georgia', displayName: 'Georgia', hasShopifyStore: true },
  { id: 'durango', name: 'Durango', displayName: 'Durango', hasShopifyStore: true },
  { id: 'muck', name: 'Muck', displayName: 'Muck', hasShopifyStore: true },
  { id: 'xtratuf', name: 'XTRATUF', displayName: 'XTRATUF', hasShopifyStore: true },
  { id: 'ranger', name: 'Ranger', displayName: 'Ranger', hasShopifyStore: true },
  { id: 'lehigh-outfitters', name: 'Lehigh Outfitters', displayName: 'Lehigh Outfitters', hasShopifyStore: true },
  { id: 'lehigh-safety-shoes', name: 'Lehigh Safety Shoes', displayName: 'Lehigh Safety Shoes', hasShopifyStore: true },
  { id: 'slipgrips', name: 'Slipgrips', displayName: 'Slipgrips', hasShopifyStore: true },
  { id: 'hard-yakka', name: 'Hard Yakka', displayName: 'Hard Yakka', hasShopifyStore: true },
]

export const DEPARTMENTS: Department[] = [
  { id: 'exec', name: 'Executive', prefix: 'EXEC', displayName: 'Executive (EXEC)' },
  { id: 'whl', name: 'Wholesale', prefix: 'WHL', displayName: 'Wholesale (WHL)' },
  { id: 'ec', name: 'Ecommerce', prefix: 'EC', displayName: 'Ecommerce (EC)' },
  { id: 'mkt', name: 'Marketing', prefix: 'MKT', displayName: 'Marketing (MKT)' },
  { id: 'cs', name: 'Customer Service', prefix: 'CS', displayName: 'Customer Service (CS)' },
]

export const ALLOWED_DOMAINS = [
  'rockybrands.com',
  'lehigh.com',
  'lehighoutfitters.com'
]

export const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'free_shipping', label: 'Free Shipping' },
]

export const CUSTOMER_SELECTION_OPTIONS = [
  { value: 'all', label: 'All Customers' },
  { value: 'prerequisite', label: 'Specific Customers' },
]

export const APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'All Products' },
  { value: 'product', label: 'Specific Products' },
  { value: 'collection', label: 'Specific Collections' },
]
