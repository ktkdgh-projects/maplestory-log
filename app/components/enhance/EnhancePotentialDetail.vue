<script setup lang="ts">
import type { EnhanceEvent, EnhanceItem, PotentialDetail, PotentialOptionTable } from '#shared/types'
import { POTENTIAL_GRADES, POTENTIAL_PARTS, RESET_METHODS, type PotentialGrade } from '#shared/data/potential'
import { useEnhanceDetail, useOpenDays } from '~/composables/useEnhanceRecords'
import { partOfSlot } from '#shared/calc/potential'
import { methodOfTool } from '#shared/calc/review'

const props = defineProps<{ ocid: string, item: EnhanceItem, from?: string, additional: boolean }>()

const TOOLS = [{ key: 'all', label: '전체' }, { key: 'cube', label: '큐브' }, { key: 'potential', label: '메소 재설정' }] as const
const tool = ref<typeof TOOLS[number]['key']>('all')

const side = computed(() => (props.additional ? props.item.summary.additional : props.item.summary.potential))
const total = computed(() => side.value.cubes + side.value.resets)
const grade = computed(() => (props.additional ? props.item.additionalGrade : props.item.potentialGrade))
const options = computed(() => (props.additional ? props.item.additionalPotentials : props.item.potentials))
// 안 낀 장비는 기록에도 다른 프리셋에도 등급이 없으면 모르는 것이다
const gradeText = (g: string | null) => g ?? (props.item.worn ? '없음' : '알 수 없음')

// 키에 횟수를 넣어 새 기록이 생기면 다시 받는다
const { detail, loading, failure, retry } = useEnhanceDetail<PotentialDetail>(
  'potential-detail',
  () => (total.value ? `${props.ocid}|${props.item.name}|${props.from ?? ''}|${props.additional}|${total.value}` : null),
  () => $fetch<PotentialDetail>(`/api/enhance/${props.ocid}/potential`, {
    query: { item: props.item.name, level: props.item.level ?? undefined, from: props.from, side: props.additional ? 'additional' : 'top' },
  }),
)

const toolName = (e: EnhanceEvent) => (e.kind === 'potential' ? '메소 재설정' : e.tool ?? '큐브')

// 등급이 오를 때까지 쓴 도구. 천장은 도구마다 따로 쌓여서 한 도구로만 돌린 단계만 천장과 견준다
const runs = computed(() => {
  const list: Set<string>[] = []
  let current = new Set<string>()
  for (const e of (detail.value?.days ?? []).flatMap(d => d.events).toReversed()) {
    current.add(toolName(e))
    if (e.success && e.grade) {
      list.push(current)
      current = new Set()
    }
  }
  return { done: list, current }
})
function ceilingOf(tools: Set<string> | undefined, g: string) {
  if (!tools || tools.size !== 1) return null
  const method = methodOfTool([...tools][0]!, props.additional)
  return method?.ceiling[POTENTIAL_GRADES.indexOf(g as PotentialGrade)] ?? null
}

// 기간 안에 기록이 없는 단계는 비워 둔다
const steps = computed(() => {
  const d = detail.value
  return POTENTIAL_GRADES.slice(0, -1).map((g, i) => {
    const next = POTENTIAL_GRADES[i + 1]!
    const at = d?.tiers.findLastIndex(t => t.from === g && t.to === next) ?? -1
    const working = at < 0 && d?.current.grade === g ? d.current.tries : null
    const tools = at >= 0 ? runs.value.done[at] : working !== null ? runs.value.current : undefined
    return { from: g, to: next, tries: at >= 0 ? d!.tiers[at]!.tries : null, working, ceiling: ceilingOf(tools, g), mixed: (tools?.size ?? 0) > 1 }
  })
})
const reached = (g: string) => !!grade.value && POTENTIAL_GRADES.indexOf(g as PotentialGrade) <= POTENTIAL_GRADES.indexOf(grade.value as PotentialGrade)

// 재설정은 기존 옵션을 고를 수 있어서 마지막으로 같은 옵션이 뜬 기록을 지금 옵션이 나온 때로 본다
const sideOptions = (e: EnhanceEvent) => (props.additional ? e.addOptions : e.options)
const foundAt = computed(() => {
  const d = detail.value
  if (!d?.current.since || !options.value.length) return null
  const run = d.days.flatMap(day => day.events).filter(e => e.at >= d.current.since!).reverse()
  const target = options.value.join('|')
  const index = run.findLastIndex(e => sideOptions(e).join('|') === target)
  return index < 0 ? null : index + 1
})

// 기간 안에 지금 등급으로 오른 기록이 있어야 "된 뒤"라고 말할 수 있다. 없으면 기간 처음부터 센 것
const runLabel = computed(() => {
  const g = grade.value
  if (!g || detail.value?.tiers.at(-1)?.to !== g) return '이 기간'
  return `${gradeSubject(g)} 된 뒤`
})

// 날짜 머리의 횟수·등급 상승·메소도 고른 기록 종류만 센다
const shownDays = computed(() => (detail.value?.days ?? [])
  .map((d) => {
    const events = d.events.filter(e => tool.value === 'all' || e.kind === tool.value)
    return { date: d.date, events, ups: events.filter(e => e.success).length, meso: events.reduce((n, e) => n + (e.meso ?? 0), 0) }
  })
  .filter(d => d.events.length))

const { open, toggle } = useOpenDays(() => detail.value?.days[0]?.date)

const gradeStyle = (g: string | null) => ({ '--grade': potentialGradeColor(g) ?? 'var(--tip-line)' })

// 공식 확률표 그 등급 첫째 줄에 있는 옵션이면 같은 등급, 없으면 한 단계 아래(이탈)다. 두 등급의 첫째 줄 글자는 겹치지 않는다
const primeLines = useState<Record<string, string[]>>('potential-prime-lines', () => ({}))
const tableBase = computed(() => {
  const part = partOfSlot(props.item.slot)
  const index = part ? POTENTIAL_PARTS.indexOf(part as typeof POTENTIAL_PARTS[number]) : -1
  if (index < 0 || !props.item.level) return null
  return { cube: RESET_METHODS.find(m => m.additional === props.additional)!.cubeItemId, part: index + 1, level: props.item.level }
})
const primeKey = (g: string) => (tableBase.value ? `${tableBase.value.cube}|${tableBase.value.part}|${tableBase.value.level}|${g}` : '')
const shownGrades = computed(() => [...new Set([grade.value, ...(detail.value?.days.flatMap(d => d.events.map(e => e.grade)) ?? [])])]
  .filter((g): g is string => POTENTIAL_GRADES.indexOf(g as PotentialGrade) > 0))
watch([tableBase, shownGrades], async ([base, grades]) => {
  if (!base) return
  for (const g of grades) {
    const k = primeKey(g)
    if (primeLines.value[k]) continue
    const table = await $fetch<PotentialOptionTable>('/api/calc/potential-options', { query: { ...base, grade: POTENTIAL_GRADES.indexOf(g as PotentialGrade) + 1 } }).catch(() => null)
    if (table) primeLines.value[k] = table.lines[0]?.map(o => o.text) ?? []
  }
}, { immediate: true })
const lineGrade = (g: string | null, text: string, index: number) => {
  const at = POTENTIAL_GRADES.indexOf(g as PotentialGrade)
  if (at <= 0 || index === 0) return g
  const prime = primeLines.value[primeKey(g!)]
  if (!prime) return null
  return prime.includes(text) ? g : POTENTIAL_GRADES[at - 1]!
}
const lineStyle = (g: string | null, text: string, index: number) => ({ '--line': potentialGradeColor(lineGrade(g, text, index)) ?? 'var(--text)' })
</script>

<template>
  <section class="detail enhance-detail" :class="{ add: additional }">
    <header class="head">
      <img v-if="item.icon" :src="item.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
      <div class="title">
        <h3>{{ item.name }}</h3>
        <p>
          {{ item.slot }}<template v-if="item.level"> · Lv.{{ item.level }}</template>
          · 윗잠 <b :style="gradeStyle(item.potentialGrade)" class="g">{{ gradeText(item.potentialGrade) }}</b>
          · 에디 <b :style="gradeStyle(item.additionalGrade)" class="g">{{ gradeText(item.additionalGrade) }}</b>
        </p>
      </div>
      <NuxtLink :to="{ path: '/calc/potential', query: { part: additional ? 'additional' : undefined, slot: item.slot, level: item.level ?? undefined, grade: grade ?? undefined } }" class="calc-link">이 장비 기대값 보기 →</NuxtLink>
    </header>

    <p v-if="!total" class="muted empty">이 기간엔 이 장비의 {{ additional ? '에디셔널' : '윗잠' }} 기록이 없어요.</p>
    <div v-else-if="!detail && failure" class="fail">
      <p class="form-error">{{ failure }}</p>
      <button type="button" class="btn ghost compact" @click="retry">다시 불러오기</button>
    </div>
    <div v-else-if="!detail" class="skeleton block" />
    <div v-else class="content" :class="{ busy: loading }">
      <div class="flow">
        <template v-for="(s, i) in steps" :key="s.from">
          <span class="node" :class="{ dim: !reached(s.from) }" :style="gradeStyle(s.from)">{{ s.from }}</span>
          <div class="edge">
            <b v-if="s.tries !== null">{{ s.tries }}번</b>
            <b v-else-if="s.working !== null" class="working">{{ s.working }}번째</b>
            <b v-else class="none">-</b>
            <div class="track"><i :style="{ width: `${s.ceiling && (s.tries ?? s.working) !== null ? Math.min(100, ((s.tries ?? s.working)! / s.ceiling) * 100) : 0}%` }" :class="{ working: s.working !== null }" /></div>
            <small>{{ s.ceiling ? `천장 ${s.ceiling}` : s.mixed ? '도구 섞음' : '' }}</small>
          </div>
          <span v-if="i === steps.length - 1" class="node" :class="{ dim: !reached(s.to) }" :style="gradeStyle(s.to)">{{ s.to }}</span>
        </template>
      </div>

      <div class="optcard" :style="gradeStyle(grade)">
        <div class="lines">
          <span v-for="(o, i) in options" :key="i" :style="lineStyle(grade, o, i)">{{ o }}</span>
          <span v-if="!options.length" class="muted">{{ item.worn ? '옵션 없음' : '지금 옵션을 알 수 없어요' }}</span>
        </div>
        <div v-if="foundAt" class="when">{{ runLabel }}<b>{{ foundAt }}번째</b>에 지금 옵션</div>
        <div v-else-if="detail.current.tries" class="when">{{ runLabel }}<b>{{ detail.current.tries }}번</b>돌림</div>
      </div>

      <div class="filter">
        <div class="chips" role="group" aria-label="기록 종류">
          <button v-for="t in TOOLS" :key="t.key" type="button" :aria-pressed="tool === t.key" @click="tool = t.key">
            {{ t.label }} {{ t.key === 'all' ? total : t.key === 'cube' ? side.cubes : side.resets }}
          </button>
        </div>
        <span class="muted small">날짜를 누르면 펼쳐져요</span>
      </div>

      <ol class="days">
        <li v-for="d in shownDays" :key="d.date" class="day" :class="{ open: open.has(d.date) }">
          <button type="button" class="day-head" :aria-expanded="open.has(d.date)" @click="toggle(d.date)">
            <span class="caret" aria-hidden="true">▸</span>
            <b>{{ formatDayWeek(d.date) }}</b>
            <span class="day-what">
              {{ d.events.length }}번<template v-if="d.ups"> · <span class="up">등급 상승 {{ d.ups }}</span></template>
            </span>
            <span class="day-meso">{{ d.meso ? formatShortNumber(d.meso) : '' }}</span>
          </button>
          <ol v-if="open.has(d.date)" class="events">
            <li v-for="(e, n) in d.events" :key="n" class="event" :class="{ up: e.success }" :style="gradeStyle(e.grade)">
              <time>{{ kstTime(e.at) }}</time>
              <span class="opts">
                <span v-for="(o, i) in sideOptions(e)" :key="i" :style="lineStyle(e.grade, o, i)">{{ o }}</span>
              </span>
              <span class="cost">{{ e.meso ? formatShortNumber(e.meso) : '' }}</span>
              <span class="result">
                <small class="tool">{{ toolName(e) }}</small>
                <span class="grade">{{ e.grade }}<small v-if="e.success" class="up-mark">▲</small></span>
              </span>
            </li>
          </ol>
        </li>
      </ol>
      <p v-if="detail.truncated" class="muted note">기록이 많아 오래된 날은 잘렸어요. 기간을 줄이면 다 보여요.</p>
    </div>
  </section>
</template>

<style scoped>
.detail {
  /* 장비를 눌러 상세로 내려갈 때 위 고정 머리줄에 가리지 않게 */
  scroll-margin-top: 108px;
  --side: var(--api);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: rgb(10 12 22 / 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.detail.add {
  --side: var(--calc);
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head img {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: contain;
  image-rendering: pixelated;
}
.title {
  min-width: 0;
}
h3 {
  margin: 0;
  color: var(--side);
  font-family: var(--f-title);
  font-size: 21px;
  font-weight: 400;
}
.title p {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.g {
  color: var(--grade);
}
.calc-link {
  flex: none;
  margin-left: auto;
  padding: 7px 12px;
  background: rgb(183 156 255 / 0.12);
  border: 1px solid rgb(183 156 255 / 0.55);
  border-radius: 8px;
  color: var(--calc);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.calc-link:hover {
  background: rgb(183 156 255 / 0.22);
}
/* 아이콘을 모르는 안 낀 장비는 같은 크기의 빈 칸 */
.no-icon {
  flex: none;
  width: 44px;
  height: 44px;
  background: var(--bar);
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
}
.block {
  flex: none;
  height: 180px;
}
.fail {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity var(--fast) ease;
}
.content.busy {
  opacity: 0.55;
}
.note {
  margin: 0;
  font-size: 12px;
}
/* 막대는 공식 천장 대비 */
.flow {
  display: grid;
  flex: none;
  grid-template-columns: auto 1fr auto 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.node {
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--grade) 55%, transparent);
  border-radius: 8px;
  color: var(--grade);
  font-family: var(--f-title);
  font-size: 16px;
  text-align: center;
  white-space: nowrap;
}
.node.dim {
  opacity: 0.35;
}
.edge {
  display: grid;
  gap: 4px;
  color: var(--sub);
  font-size: 12px;
  text-align: center;
}
.edge b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.edge b.working {
  color: var(--gold);
}
.edge b.none {
  color: var(--tip-line);
}
.track {
  position: relative;
  height: 6px;
  overflow: hidden;
  background: #11152a;
  border-radius: 3px;
}
.track i {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--tip-line);
  border-radius: 3px;
}
.track i.working {
  background: var(--gold);
}
.optcard {
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 18px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--grade) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--grade) 45%, transparent);
  border-radius: 10px;
}
.lines {
  display: grid;
  gap: 2px;
  font-size: 15px;
}
.lines span {
  color: var(--line);
}
.lines span:first-child {
  font-weight: 700;
}
.when {
  align-self: center;
  color: var(--sub);
  font-size: 12px;
  text-align: right;
}
.when b {
  display: block;
  color: var(--text);
  font-family: var(--f-title);
  font-size: 22px;
  font-weight: 400;
}
.filter {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chips button {
  padding: 3px 11px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.chips button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--side) 14%, transparent);
  border-color: var(--side);
  color: var(--side);
}
.small {
  margin-left: auto;
  font-size: 12px;
}
.days {
  display: grid;
  align-content: start;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.day {
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.day.open {
  border-color: var(--tip-line);
}
.day-head {
  display: grid;
  grid-template-columns: 14px minmax(92px, max-content) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.caret {
  color: var(--sub);
  transition: rotate var(--fast) ease;
}
.day.open .caret {
  rotate: 90deg;
}
.day-head b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.day-what {
  color: var(--sub);
}
.up {
  color: var(--gain);
}
.day-meso {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.events {
  display: grid;
  gap: 2px;
  margin: 0 10px 8px;
  padding: 0;
  list-style: none;
}
/* 칸을 고정해 줄마다 위치가 같게 */
.event {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 70px 200px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgb(255 255 255 / 0.02);
  border-left: 3px solid var(--grade);
  border-radius: 4px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.event time {
  color: var(--sub);
}
.opts {
  display: grid;
  min-width: 0;
  line-height: 1.45;
}
.opts span {
  overflow: hidden;
  color: var(--line);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cost {
  color: var(--tip-line);
  text-align: right;
}
.result {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.tool {
  overflow: hidden;
  color: var(--tip-line);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grade {
  flex: none;
  color: var(--grade);
  font-family: var(--f-title);
  font-size: 13px;
}
.up-mark {
  margin-left: 2px;
  color: var(--gain);
  font-size: 10px;
}
.empty {
  margin: 0;
  padding: 24px;
  text-align: center;
}
@media (max-width: 640px) {
  .head {
    flex-wrap: wrap;
  }
  .chips button {
    min-height: 36px;
    padding: 4px 12px;
  }
  .title {
    flex: 1;
  }
  .calc-link {
    width: 100%;
    margin-left: 0;
    text-align: center;
  }
  .flow {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 8px 12px;
  }
  .edge {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    text-align: left;
  }
  .small {
    display: none;
  }
  .day-head {
    grid-template-columns: 12px minmax(72px, max-content) minmax(0, 1fr) auto;
    min-height: 40px;
    gap: 6px;
    font-size: 12px;
  }
  .events {
    margin: 0 6px 6px;
  }
  .event {
    grid-template-areas: "time cost result" "opts opts opts";
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 2px 10px;
    padding: 6px 8px;
  }
  .event time {
    grid-area: time;
  }
  .opts {
    grid-area: opts;
  }
  .cost {
    grid-area: cost;
  }
  .result {
    grid-area: result;
  }
}
</style>
