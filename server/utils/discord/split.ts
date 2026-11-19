import { ObjectId } from 'mongodb'
import { PARTY_SPLIT_FEES, partySplit } from '#shared/calc/partySplit'
import type { PartySplitRequest } from '#shared/types'
import type { PartyDoc } from './db'
import { useBotCollections } from './db'
import { sendDiscordMessage } from './api'
import { partyCharacter } from './party'
import { partyCard } from './week'

const SALE_MAX = 1e13
const meso = (value: number) => value.toLocaleString('ko-KR')

// 분배금은 웹 화면에서 숫자를 넣어 미리 보고, 채널에는 정리된 결과만 올린다
export async function postPartySplit(party: PartyDoc, userId: string, body: Partial<PartySplitRequest>) {
  const bad = (message: string) => createError({ statusCode: 400, message })
  const { sale, cost, feeRate, sellerId, payerId } = body
  const memberIds = Array.isArray(body.memberIds) ? [...new Set(body.memberIds)] : []
  if (!Number.isSafeInteger(sale) || sale! <= 0 || sale! > SALE_MAX) throw bad('판매 금액을 숫자로 적어 주세요.')
  if (!Number.isSafeInteger(cost) || cost! < 0) throw bad('소재·유행 값을 숫자로 적어 주세요.')
  if (!PARTY_SPLIT_FEES.includes(feeRate!)) throw bad('수수료를 다시 골라 주세요.')
  if (memberIds.length < 2 || memberIds.some(id => !party.members.some(m => m.userId === id))) throw bad('나눌 파티원을 두 명 이상 골라 주세요.')
  if (!memberIds.includes(sellerId!) || (cost! > 0 && !memberIds.includes(payerId!))) throw bad('판 사람과 비용 낸 사람은 나누는 파티원 중에서 골라 주세요.')

  const payer = cost! > 0 ? payerId! : sellerId!
  const result = partySplit({ sale: sale!, saleFee: feeRate!, cost: cost!, sellerId: sellerId!, payerId: payer, members: memberIds.map(id => ({ id, weight: 1, fee: feeRate! })) })
  if (!result) throw bad('소재·유행 값이 판매 금액보다 커서 나눌 돈이 없어요.')

  const share = result.rows.find(r => r.id !== sellerId)!.own
  const lines = result.rows.map((row) => {
    const name = `**${partyCharacter(party, row.id)}**`
    if (row.id === sellerId) return `${name} (판매) · 남는 돈 **${meso(row.receive)}**`
    return `${name} · 경매장에 **${meso(row.send)}**에 올리기 → 받는 돈 ${meso(row.receive)}${row.id === payer && cost ? ' (비용 포함)' : ''}`
  })
  const description = [
    `판매 **${formatKoreanNumber(sale!)}** (${meso(sale!)}) · 수수료 ${feeRate! * 100}% · ${memberIds.length}명`,
    ...(cost ? [`소재·유행 **${formatKoreanNumber(cost)}** (${meso(cost)}) · ${partyCharacter(party, payer)}`] : []),
    `한 사람 몫 **${meso(share)}**`,
    '',
    ...lines,
  ].join('\n')
  const card = partyCard('💰 분배금', description, memberIds)
  await sendDiscordMessage(party.channelId, { ...card, embeds: [{ ...card.embeds[0], footer: { text: '판매 수수료, 보낼 때 수수료, 소재·유행 값을 모두 똑같이 나눴어요' } }] })

  const { splits } = await useBotCollections()
  await splits.insertOne({ _id: new ObjectId(), partyId: party._id, sale: sale!, cost: cost!, sellerId: sellerId!, payerId: payer, feeRate: feeRate!, memberIds, createdBy: userId, createdAt: new Date() })
}
