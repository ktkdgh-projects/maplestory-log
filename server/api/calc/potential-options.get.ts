import type { PotentialOption, PotentialOptionTable } from '#shared/types'
import { OPTION_TABLE_MAX_LEVEL, POTENTIAL_GRADES, POTENTIAL_PARTS, RESET_METHODS } from '#shared/data/potential'

const SOURCE_URL = 'https://maplestory.nexon.com/Guide/OtherProbability/cube/GetSearchProbList'
// 확률표는 패치 때만 바뀌어서 길게 둔다
const CACHE_MS = 3 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 10_000

const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').trim()

// 응답 위쪽의 조건 글자는 고정 문구라 믿지 않고 줄별 표만 읽는다
const TABLES = [/<table class="cube_data _1">([\s\S]*?)<\/table>/, /<table class="cube_data _2">([\s\S]*?)<\/table>/, /<table class="cube_data _3">([\s\S]*?)<\/table>/]
const ROW = /<tr>\s*<td>([\s\S]*?)<\/td>[\s\S]*?<td>([\d.]+)%<\/td>\s*<\/tr>/g

function parseOptionTable(html: string): PotentialOptionTable {
  return {
    lines: TABLES.map(pattern => [...(html.match(pattern)?.[1] ?? '').matchAll(ROW)].map((r): PotentialOption => ({ text: decode(r[1]!), prob: Number(r[2]) }))),
  }
}

// grade: 1(레어)~4(레전드리), part: 넥슨 장비 분류 코드
export default defineEventHandler(async (event): Promise<PotentialOptionTable> => {
  const query = getQuery(event)
  const cube = Number(query.cube)
  const grade = Number(query.grade)
  const part = Number(query.part)
  const level = Math.min(OPTION_TABLE_MAX_LEVEL, Math.max(0, Math.floor(Number(query.level))))
  if (!RESET_METHODS.some(m => m.cubeItemId === cube)
    || !Number.isInteger(grade) || grade < 1 || grade > POTENTIAL_GRADES.length
    || !Number.isInteger(part) || part < 1 || part > POTENTIAL_PARTS.length
    || !Number.isFinite(level)) {
    throw createError({ statusCode: 400, message: '조건을 다시 골라 주세요.' })
  }

  return withCache(`potential-options:${cube}:${grade}:${part}:${level}`, CACHE_MS, async () => {
    // 넥슨을 부르는 캐시 미스만 IP당 제한한다
    await rateLimit(event, 'potential-options', 30, 60)
    const html = await $fetch<string>(SOURCE_URL, {
      method: 'POST',
      // 브라우저 요청처럼 보내지 않으면 표 대신 이벤트 페이지를 돌려준다
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://maplestory.nexon.com/Guide/OtherProbability/cube/black' },
      body: new URLSearchParams({ nCubeItemID: String(cube), nGrade: String(grade), nPartsType: String(part), nReqLev: String(level) }),
      responseType: 'text',
      timeout: TIMEOUT_MS,
    }).catch(() => {
      throw createError({ statusCode: 502, message: '넥슨 확률표를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' })
    })
    const table = parseOptionTable(html)
    if (!table.lines[0]!.length) throw createError({ statusCode: 404, message: '이 조건의 확률표가 없어요.' })
    return table
  })
})
