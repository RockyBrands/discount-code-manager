// @ts-check

/**
 * Applies a percentage discount to the most expensive eligible item in the cart.
 * Eligibility is resolved in the input query: products with an excluded tag are
 * ineligible, and when the discount config restricts to collections, only lines
 * whose product is in one of those collections qualify.
 *
 * Configuration is read from the discount's `function-configuration` metafield:
 *   { "percentage": 50, "excludedTags": ["no-discount"], "collectionIds": [], "minimumSubtotal": 0, "maxDiscountAmount": 0, "freeShipping": false }
 *
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

import { parseConfig, eligibleLines } from './shared'

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

  const maxDiscount = Number(config.maxDiscountAmount) || 0

  const eligible = eligibleLines(cart, config)

  if (!eligible.length) {
    return NO_RESULT
  }

  const target = eligible.reduce((best, line) =>
    Number(line.cost.amountPerQuantity.amount) > Number(best.cost.amountPerQuantity.amount) ? line : best
  )

  const pctAmount = Number(target.cost.amountPerQuantity.amount) * percentage / 100
  const value = maxDiscount > 0 && pctAmount > maxDiscount
    ? { fixedAmount: { amount: maxDiscount } }
    : { percentage: { value: percentage } }

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
              value,
            },
          ],
          selectionStrategy: 'FIRST',
        },
      },
    ],
  }
}
