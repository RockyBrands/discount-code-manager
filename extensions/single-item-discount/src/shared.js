// @ts-check

export function parseConfig(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function eligibleLines(cart, config) {
  const requireCollection = Array.isArray(config.collectionIds) && config.collectionIds.length > 0
  const minimumSubtotal = Number(config.minimumSubtotal) || 0

  const eligible = cart.lines.filter(line => {
    if (line.merchandise.__typename !== 'ProductVariant') return false
    if (line.merchandise.product.hasAnyTag) return false
    if (requireCollection && !line.merchandise.product.inAnyCollection) return false
    return true
  })

  if (minimumSubtotal > 0) {
    const eligibleSubtotal = eligible.reduce(
      (sum, line) => sum + Number(line.cost.subtotalAmount.amount),
      0
    )
    if (eligibleSubtotal < minimumSubtotal) {
      return []
    }
  }

  return eligible
}
