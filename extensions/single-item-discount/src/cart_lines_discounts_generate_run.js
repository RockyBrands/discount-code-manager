// @ts-check

/**
 * Applies a percentage discount to the most expensive eligible item in the cart.
 * Eligibility is resolved in the input query: products with an excluded tag are
 * ineligible, and when the discount config restricts to collections, only lines
 * whose product is in one of those collections qualify.
 *
 * Configuration is read from the discount's `function-configuration` metafield:
 *   { "percentage": 50, "excludedTags": ["no-discount"], "collectionIds": [], "minimumSubtotal": 0 }
 *
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const NO_RESULT = { operations: [] }

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const { cart, discount } = input

  if (!cart.lines.length) {
    return NO_RESULT
  }
  if (!discount.discountClasses.includes('PRODUCT')) {
    return NO_RESULT
  }

  const config = parseConfig(discount.metafield?.value)
  const percentage = Number(config?.percentage)
  if (!config || !Number.isFinite(percentage) || percentage <= 0) {
    return NO_RESULT
  }

  const requireCollection = Array.isArray(config.collectionIds) && config.collectionIds.length > 0
  const minimumSubtotal = Number(config.minimumSubtotal) || 0

  const eligible = cart.lines.filter(line => {
    if (line.merchandise.__typename !== 'ProductVariant') return false
    if (line.merchandise.product.hasAnyTag) return false
    if (requireCollection && !line.merchandise.product.inAnyCollection) return false
    return true
  })

  if (!eligible.length) {
    return NO_RESULT
  }

  if (minimumSubtotal > 0) {
    const eligibleSubtotal = eligible.reduce(
      (sum, line) => sum + Number(line.cost.subtotalAmount.amount),
      0
    )
    if (eligibleSubtotal < minimumSubtotal) {
      return NO_RESULT
    }
  }

  const target = eligible.reduce((best, line) =>
    Number(line.cost.amountPerQuantity.amount) > Number(best.cost.amountPerQuantity.amount) ? line : best
  )

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `${percentage}% OFF ONE ITEM`,
              targets: [
                {
                  cartLine: {
                    id: target.id,
                    quantity: 1,
                  },
                },
              ],
              value: {
                percentage: {
                  value: percentage,
                },
              },
            },
          ],
          selectionStrategy: 'FIRST',
        },
      },
    ],
  }
}

function parseConfig(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
