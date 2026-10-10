import type { PotentialOption, PotentialOptionTable } from '#shared/types'
import { OPTION_TABLE_MAX_LEVEL, POTENTIAL_GRADES, POTENTIAL_PARTS, RESET_METHODS } from '#shared/data/potential'

const SOURCE_URL = 'https://maplestory.nexon.com/Guide/OtherProbability/cube/GetSearchProbList'
// 확률표는 패치 때만 바뀌어서 길게 둔다
const CACHE_MS = 3 * 24 * 60 * 60 * 1000
const TIMEOUT_MS = 10_000

const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').trim()

// 공식 페이지는 줄마다 <table class="cube_data _1|_2|_3">에 (옵션, 확률) 행을 그린다. 응답 위쪽의 조건 글자는 고정 문구라 믿지 않는다
const TABLES = [/<table class="cube_data _1">([\s\S]*?)<\/table>/, /<table class="cube_data _2">([\s\S]*?)<\/table>/, /<table class="cube_data _3">([\s\S]*?)<\/table>/]
const ROW = /<tr>\s*<td>([\s\S]*?)<\/td>[\s\S]*?<td>([\d.]+)%<\/td>\s*<\/tr>/g

function parseOptionTable(html: string): PotentialOptionTable {
  return {
    lines: TABLES.map(pattern => [...(html.match(pattern)?.[1] ?? '').matchAll(ROW)].map((r): PotentialOption => ({ text: decode(r[1]!), prob: Number(r[2]) }))),
  }
}

// 공식 잠재 옵션 확률표를 받아 캐시한다. cube: 큐브 아이템 id, grade: 1(레어)~4(레전드리), part: 장비 분류 코드
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
    // 캐시에 없을 때만 넥슨에 묻는다. 같은 IP가 짧은 시간에 너무 많이 새 조건을 부르면 막는다
    await rateLimit(event, 'potential-options', 30, 60)
    const html = await $fetch<string>(SOURCE_URL, {
      method: 'POST',
      // 브라우저 요청처럼 보내지 않으면 표 대신 이벤트 페이지를 돌려준다
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://maplestory.nexon.com/Guide/OtherProbability/cube/black' },
      body: new URLSearchParams({ nCubeItemID: String(cube), nGrade: String(grade), nPartsType: String(part), nReqLev: String(level) }),
      responseType: 'text',
      timeout: TIMEOUT_MS,
    }).catch(() => {
      throw createError({ statusCode: 502, message: '넥슨 확률표를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
    })
    const table = parseOptionTable(html)
    if (!table.lines[0]!.length) throw createError({ statusCode: 404, message: '이 조건의 확률표가 없어요.' })
    return table
  })
})
