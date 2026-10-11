import type { CharacterBrief, EquipmentItem, ReviewResponse } from '#shared/types'
import type { ObjectId } from 'mongodb'

const SYNC_BUDGET_MS = 4000
const EQUIP_BATCH = 6

interface Range { from: string, to: string }

// 스타포스 비용은 낀 장비의 착용 레벨로 센다. 장비를 못 받아도 기록은 보여 준다
async function reviewOne(userId: ObjectId, character: CharacterBrief, names: string[], range: Range, apiKey: () => Promise<string>, mvp: MvpTimeline) {
  let equipped: EquipmentItem[] = []
  let equipmentMissing = false
  try {
    equipped = await getEquippedItems(apiKey, character.ocid)
  }
  catch (error) {
    console.warn('[review] 장비 정보 받기 실패', redactApiKeys(String(error)))
    equipmentMissing = true
  }
  const owner = { ocid: character.ocid, name: character.name }
  const [starforce, potential] = await Promise.all([
    reviewStarforce(userId, owner, names, range, equipped, mvp),
    reviewPotential(userId, owner, names, range, equipped),
  ])
  return { starforce, potential, equipmentMissing }
}

// ocid가 all이면 기록이 있는 캐릭터를 모두 합친다. 기대값 비교는 브라우저가 한다
export default defineEventHandler(async (event): Promise<ReviewResponse> => {
  const user = requireUser(event)
  const today = kstToday()
  const range = parseReviewRange(getQuery(event), today)
  const ocid = getRouterParam(event, 'ocid')

  const keyPromise = getUserApiKey(user._id)
  keyPromise.catch(() => {})
  const apiKey = () => keyPromise
  const paused = isCollectionPaused()
  paused.catch(() => {})
  // 어제·오늘이 들어 있는 기간만 새 기록을 먼저 모은다. 지난날은 이미 모여 있어 날짜를 바꿀 때마다 기다리지 않게
  const sync = async () => {
    if (range.to >= kstYesterday() && user.keyStatus === 'valid' && !(await paused)) await syncEnhanceHistory(user._id, SYNC_BUDGET_MS)
  }
  const mvp = mvpTimeline(user)

  if (ocid !== 'all') {
    const character = await ownCharacter(user._id, ocid, apiKey)
    await sync()
    const names = await characterNames(character)
    if (!(await hasRecords(user._id, names, range))) {
      return { character, ...range, starforce: [], potential: [], recordDays: await recordDays(user._id, names, today) }
    }
    const [one, days] = await Promise.all([reviewOne(user._id, character, names, range, apiKey, mvp), recordDays(user._id, names, today)])
    return { character, ...range, ...one, recordDays: days }
  }

  const [characters] = await Promise.all([accountCharacters(user._id, apiKey), sync()])
  const named = await charactersNames(characters)
  const allNames = named.flatMap(n => n.names)
  const { enhanceEvents } = await useCollections()
  const [recorded, days] = await Promise.all([
    enhanceEvents.distinct('character', { userId: user._id, character: { $in: allNames }, at: { $gte: kstDayStart(range.from), $lt: kstDayStart(addDays(range.to, 1)) } }),
    recordDays(user._id, allNames, today),
  ])
  const withRecords = named.filter(n => n.names.some(name => recorded.includes(name)))
  const results = []
  for (let i = 0; i < withRecords.length; i += EQUIP_BATCH) {
    results.push(...await Promise.all(withRecords.slice(i, i + EQUIP_BATCH).map(n => reviewOne(user._id, n.character, n.names, range, apiKey, mvp))))
  }
  return {
    character: null,
    ...range,
    starforce: results.flatMap(r => r.starforce),
    potential: results.flatMap(r => r.potential),
    recordDays: days,
    equipmentMissing: results.some(r => r.equipmentMissing),
  }
})
