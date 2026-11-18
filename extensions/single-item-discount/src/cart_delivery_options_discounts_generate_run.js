// @ts-check

/**
 * Applies free economy shipping when the discount config opts in via
 * `"freeShipping": true` and the cart has at least one eligible line (same
 * eligibility rules as the single-item percentage discount: not excluded by
 * tag, in an allowed collection when configured, and eligible subtotal at or
 * above `minimumSubtotal`). Only delivery options whose method is shipping and
 * whose title or handle matches /economy/i are discounted.
 *
 * Configuration is read from the discount's `function-configuration` metafield:
 *   { "percentage": 50, "excludedTags": ["no-discount"], "collectionIds": [], "minimumSubtotal": 0, "maxDiscountAmount": 0, "freeShipping": false }
 *
 * @typedef {import("../generated/api").DeliveryInput} RunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsDiscountsGenerateRunResult} CartDeliveryOptionsDiscountsGenerateRunResult
 */

import { parseConfig, eligibleLines } from './shared'

const NO_RESULT = { operations: [] }

/**
 * @param {RunInput} input
 * @returns {CartDeliveryOptionsDiscountsGenerateRunResult}
 */
export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  const { cart, discount } = input

  if (!discount.discountClasses.includes('SHIPPING')) {
    return NO_RESULT
  }

  const config = parseConfig(discount.metafield?.value)
  if (!config || config.freeShipping !== true) {
    return NO_RESULT
  }

  if (!cart.lines.length) {
    return NO_RESULT
  }

  if (!eligibleLines(cart, config).length) {
    return NO_RESULT
  }

  const handles = []
  for (const group of cart.deliveryGroups) {
    for (const option of group.deliveryOptions) {
      if (option.deliveryMethodType !== 'SHIPPING') continue
      if (!/economy/i.test(option.title || '') && !/economy/i.test(option.handle || '')) continue
      handles.push(option.handle)
    }
  }

  if (!handles.length) {
    return NO_RESULT
  }

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: 'FREE ECONOMY SHIPPING',
              targets: handles.map(handle => ({ deliveryOption: { handle } })),
              value: {
                percentage: {
                  value: 100,
                },
              },
            },
          ],
          selectionStrategy: 'ALL',
        },
      },
    ],
  }
}
