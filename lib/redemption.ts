import { prisma } from './prisma'
import { serviceForShop } from './shopify-session'

const MAX_ATTEMPTS = 10

export async function recordRedemptions(shopDomain: string, orderId: string | undefined, codes: string[]) {
  const shop = await prisma.shop.findUnique({ where: { shopDomain: shopDomain.toLowerCase() } })

  const redeemed: string[] = []
  for (const rawCode of codes) {
    const code = rawCode?.trim()
    if (!code) continue

    const discountCode = await prisma.discountCode.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        redeemedAt: null,
        deletedAt: null,
      },
      include: {
        discountGroup: {
          include: { shopDiscounts: { include: { shop: true } } },
        },
      },
    })

    if (!discountCode) continue

    const shopDiscount = discountCode.discountGroup.shopDiscounts.find(
      sd => sd.shop.shopDomain === shopDomain.toLowerCase()
    )
    if (!shopDiscount) continue

    const claimed = await prisma.discountCode.updateMany({
      where: { id: discountCode.id, redeemedAt: null },
      data: {
        redeemedAt: new Date(),
        redeemedOnShopId: shop?.id,
        redeemedOrderId: orderId,
      },
    })
    if (claimed.count === 0) continue

    await prisma.codeRemovalJob.createMany({
      data: discountCode.discountGroup.shopDiscounts.map(sd => ({
        discountCodeId: discountCode.id,
        shopDiscountId: sd.id,
      })),
      skipDuplicates: true,
    })

    redeemed.push(code)
  }

  return redeemed
}

export async function processPendingRemovals(opts: { maxElapsedMs?: number } = {}) {
  const deadline = Date.now() + (opts.maxElapsedMs ?? 60_000)

  const jobs = await prisma.codeRemovalJob.findMany({
    where: { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      discountCode: true,
      shopDiscount: { include: { shop: true } },
    },
  })

  let processed = 0
  const results: { jobId: string; ok: boolean; error?: string }[] = []

  await Promise.all(
    jobs.map(async job => {
      try {
        if (job.shopDiscount.shop.uninstalledAt) {
          await prisma.codeRemovalJob.update({ where: { id: job.id }, data: { status: 'skipped', lastError: 'Shop uninstalled' } })
          results.push({ jobId: job.id, ok: true })
          return
        }

        const service = serviceForShop(job.shopDiscount.shop)
        await service.removeRedeemCode(job.shopDiscount.shopifyDiscountId, job.discountCode.code)

        await prisma.$transaction([
          prisma.codeRemovalJob.update({
            where: { id: job.id },
            data: { status: 'done', lastError: null },
          }),
          prisma.discountCode.updateMany({
            where: { id: job.discountCodeId, deletedAt: null },
            data: { deletedAt: new Date() },
          }),
        ])
        results.push({ jobId: job.id, ok: true })
      } catch (err) {
        const message = (err as Error).message
        const attempts = job.attempts + 1
        await prisma.codeRemovalJob.update({
          where: { id: job.id },
          data: {
            attempts,
            lastError: message.slice(0, 1000),
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          },
        })
        results.push({ jobId: job.id, ok: false, error: message })
      }
      processed++
    })
  )

  if (jobs.length === 200 && Date.now() < deadline) {
    const more = await prisma.codeRemovalJob.count({ where: { status: 'pending', attempts: { lt: MAX_ATTEMPTS } } })
    return { processed, remaining: more, results }
  }

  return { processed, remaining: 0, results }
}
