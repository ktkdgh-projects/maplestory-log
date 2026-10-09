import type { LedgerSettings } from '#shared/types'

export default defineEventHandler(async (event): Promise<LedgerSettings> => {
  const user = requireUser(event)
  const { feeRate, balanceDate, balance } = await loadLedgerSettings(user._id)
  return {
    feeRate,
    balance: balanceDate && balance !== null
      ? { checkedAt: balanceDate, checked: balance, current: await currentBalance(user._id, balanceDate, balance) }
      : null,
  }
})
