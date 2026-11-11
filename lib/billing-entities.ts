export const BILLING_ENTITIES = [
  { id: 'rocky-boots', label: 'Rocky Boots', prefix: 'RB' },
  { id: 'ranger-boots', label: 'Ranger Boots', prefix: 'RG' },
  { id: 'georgia-boot', label: 'Georgia Boot', prefix: 'GB' },
  { id: 'durango-boots', label: 'Durango Boots', prefix: 'DB' },
  { id: 'muck-boot', label: 'Muck Boot Co', prefix: 'MB' },
  { id: 'xtratuf', label: 'XTRATUF', prefix: 'XT' },
  { id: 'wholesale', label: 'Wholesale', prefix: 'WH' },
  { id: 'exec-board', label: 'Executive & Board', prefix: 'EB' },
  { id: 'customer-service', label: 'Customer Service', prefix: 'CS' },
  { id: 'other', label: 'Other', prefix: 'OT' },
] as const

export type BillingEntityId = (typeof BILLING_ENTITIES)[number]['id']

export function billingEntityById(id: string) {
  return BILLING_ENTITIES.find(e => e.id === id)
}
