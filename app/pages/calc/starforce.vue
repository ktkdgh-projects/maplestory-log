<script setup lang="ts">
import type { CharacterDetail, EquipmentItem, SundayNotice, SundayResponse } from '#shared/types'
import type { RestoreOption, StageInfo, StarforceOptions, StarforcePlan } from '#shared/calc/starforce'
import { MVP_DISCOUNTS, OFFICIAL_RATE_FROM, PROTECT_STARS, SUNDAY_STARFORCE_EFFECTS, maxStars, restoreCopies } from '#shared/data/starforce'

useHead({ title: '스타포스 기대값 · 메이플스토리로그' })

const route = useRoute()
const { me } = await useMe()

const LEVELS = [130, 140, 150, 160, 200, 250]
const TARGETS = [17, 18, 21, 22, 23, 25]
const queryNumber = (key: string) => (route.query[key] !== undefined && Number(route.query[key]) >= 0 ? Number(route.query[key]) : null)

const level = ref(queryNumber('level') || 200)
// 주소나 내 장비에서 온 레벨이 칩에 없으면 그 레벨 칩을 하나 더 둔다
const levelChips = computed(() => (LEVELS.includes(level.value) ? LEVELS : [...LEVELS, level.value].sort((a, b) => a - b)))
const max = computed(() => maxStars(level.value))
const from = ref(queryNumber('from') ?? 17)
const to = ref(queryNumber('to') ?? 22)
const protect = ref<number[]>([])
const discount = ref(false)
const sure = ref(false)
const lessDestroy = ref(false)
const mvp = ref(me.value?.mvpDiscount ?? 0)
const pc = ref(false)
// 노작: 흔적 복구에 쓰는 같은 장비 1개
const copyPrice = ref<number | null>(null)
const restoreDiscount = ref(false)
const showMore = ref(false)

// 이번 주 썬데이에 스타포스 효과가 있으면(운영자가 공지를 보고 고른 것) 처음 열 때 켠다
const sunday = ref<SundayNotice | null>(null)
onMounted(async () => {
  const notice = (await $fetch<SundayResponse>('/api/sunday').catch(() => null))?.current
  if (!notice?.effects?.length) return
  sunday.value = notice
  setSundayEffects(true)
})
function setSundayEffects(on: boolean) {
  const effects = sunday.value?.effects ?? []
  discount.value = on && effects.includes('discount')
  sure.value = on && effects.includes('sure')
  lessDestroy.value = on && effects.includes('lessDestroy')
  restoreDiscount.value = on && effects.includes('restoreDiscount')
}
const sundayApplied = computed(() => !!sunday.value && (discount.value || sure.value || lessDestroy.value || restoreDiscount.value))
const sundayEffects = computed(() => SUNDAY_STARFORCE_EFFECTS.filter(e => sunday.value?.effects?.includes(e.key)).map(e => e.label))
const sundayDay = computed(() => (sunday.value ? formatDay(kstDateOf(sunday.value.start)) : ''))

// 성급은 늘 0 ≤ 지금 < 목표 ≤ 최대로 맞춘다. 지금을 목표 이상으로 올리면 목표도 따라 올라간다
function setFrom(value: number) {
  from.value = Math.min(Math.max(0, Math.round(value) || 0), max.value - 1)
  if (to.value <= from.value) to.value = from.value + 1
}
function setTo(value: number) {
  to.value = Math.min(Math.max(from.value + 1, Math.round(value) || 0), max.value)
}
const canProtect = (star: number) => star >= from.value && star < to.value
// change(엔터·포커스 아웃)에만 반영해 '2'를 치는 순간 18로 바뀌지 않게 하고, 값이 그대로면 다시 안 그려지니 칸 글자는 직접 되돌린다
function commitFrom(event: Event) {
  const input = event.target as HTMLInputElement
  setFrom(Number(input.value))
  input.value = String(from.value)
}
function commitTo(event: Event) {
  const input = event.target as HTMLInputElement
  setTo(Number(input.value))
  input.value = String(to.value)
}
watch(max, () => {
  setFrom(from.value)
  setTo(to.value)
})
// 주소로 받은 성급도 같은 범위로 맞춘다
setFrom(from.value)
setTo(to.value)

// 대표 캐릭터가 지금 낀 장비로 채운다. 받는 동안에도 칸 자리는 잡아 둔다
const equipped = ref<EquipmentItem[]>([])
const equipState = ref<'loading' | 'done' | 'failed'>('loading')
const pickedSlot = ref('')
onMounted(async () => {
  const name = me.value?.main?.name
  if (!name) return
  const detail = await $fetch<CharacterDetail>(`/api/character/${encodeURIComponent(name)}`).catch(() => null)
  equipped.value = (detail?.presets[detail.presetNo - 1] ?? []).filter(i => i.requiredLevel && maxStars(i.requiredLevel) > 0 && i.scrollUpgradeable + i.scrollUpgrade > 0)
  equipState.value = detail ? 'done' : 'failed'
})
const equipOptions = computed(() => [
  { value: '', label: '직접 고르기' },
  ...equipped.value.map(i => ({ value: i.slot, label: `${i.slot} · ${i.name}`, sub: `★${i.starforce}` })),
])
const equipPlaceholder = computed(() => (equipState.value === 'loading' ? '장비 불러오는 중…' : equipState.value === 'failed' ? '장비를 불러오지 못했어요' : '강화할 장비가 없어요'))
watch(pickedSlot, (slot) => {
  const item = equipped.value.find(i => i.slot === slot)
  if (!item) return
  level.value = item.requiredLevel
  setFrom(item.starforce)
  setTo(from.value + 1)
})

const options = computed<StarforceOptions>(() => ({
  level: level.value,
  from: from.value,
  to: to.value,
  protect: protect.value.filter(canProtect),
  discount: discount.value,
  sure: sure.value,
  lessDestroy: lessDestroy.value,
  mvp: mvp.value,
  pc: pc.value,
  copyPrice: copyPrice.value ?? 0,
  restoreDiscount: restoreDiscount.value,
}))
// Worker에서 계산하고, 입력이 잠깐 멈췄을 때 마지막 값만 계산한다
const plan = shallowRef<StarforcePlan | null>(null)
const calculating = ref(false)
const calcError = ref('')
const worker = useStarforceWorker()
let timer: ReturnType<typeof setTimeout> | undefined
let calcSeq = 0
async function calculate() {
  // 아직 이전 계산 중이면 기다리지 않고 버리고 새로 시작한다
  if (worker.busy()) worker.cancel()
  const seq = ++calcSeq
  calculating.value = true
  try {
    const result = await worker.plan(options.value)
    if (seq !== calcSeq) return
    plan.value = result
    calcError.value = ''
  }
  catch (error) {
    if (seq === calcSeq) calcError.value = errorMessage(error)
  }
  finally {
    if (seq === calcSeq) calculating.value = false
  }
}
onMounted(calculate)
onBeforeUnmount(() => clearTimeout(timer))
watch(options, () => {
  clearTimeout(timer)
  timer = setTimeout(calculate, 120)
}, { deep: true })
// 넘기는 데 평균 메소(1번 비용 ÷ 성공 확률)가 가장 큰 구간
const priciest = computed(() => {
  let best: StageInfo | null = null
  for (const s of plan.value?.stages ?? []) if (!best || s.cost / s.success > best.cost / best.success) best = s
  return best?.star ?? null
})
function toggleProtect(star: number) {
  protect.value = protect.value.includes(star) ? protect.value.filter(s => s !== star) : [...protect.value, star]
}
const usesWiki = computed(() => from.value < OFFICIAL_RATE_FROM)
const showStages = ref(false)
// 넓은 화면은 결과 칸 아래가 비어서 ★별 표를 펼쳐 둔다
onMounted(() => {
  if (window.matchMedia('(min-width: 1100px) and (min-height: 700px)').matches) showStages.value = true
})

// 이어지는 성급에서 고를 길이 같으면 한 칩으로 묶는다 (★23~29 → ★22 흔적 복구)
const restoreGroups = computed(() => {
  const groups: { from: number, to: number, choice: RestoreOption['choice'], trace: number | null, items: RestoreOption[] }[] = []
  for (const r of plan.value?.restores ?? []) {
    // 흔적 복구는 22성 이하면 그 성급으로, 23성 이상이면 22성으로 돌아가서 이 기준으로 묶는다
    const trace = r.choice === 'restore' && r.trace !== r.star ? r.trace : null
    const last = groups.at(-1)
    if (last && last.choice === r.choice && last.trace === trace && last.to === r.star - 1) {
      last.to = r.star
      last.items.push(r)
    }
    else groups.push({ from: r.star, to: r.star, choice: r.choice, trace, items: [r] })
  }
  return groups
})
const groupLabel = (g: typeof restoreGroups.value[number]) => {
  const range = g.from === g.to ? `★${g.from}` : `★${g.from}~${g.to}`
  const action = g.choice === 'twelve' ? '12성 복구' : g.trace ? `★${g.trace} 흔적 복구` : g.from === g.to ? `★${g.from} 흔적 복구` : '그 성급으로 흔적 복구'
  return { range, action }
}
const restorePicked = ref(0)
watch(restoreGroups, () => (restorePicked.value = 0))
function restoreDetail(r: RestoreOption) {
  const cost = r.choice === 'restore' ? `노작 ${restoreCopies(r.trace)}개 + 복구 메소 ${formatShortNumber(r.restoreCost - restoreCopies(r.trace) * options.value.copyPrice)}` : '노작 1개'
  return `${cost}${r.saving >= 1e6 ? ` · 다른 길보다 ${formatShortNumber(r.saving)} 이득` : ''}`
}
const srcNote = computed(() => `공식 발표가 없어 위키 기준: ${usesWiki.value ? '0~14성 확률, ' : ''}스타캐치 보너스(×1.05), 1번 비용 공식, 흔적 복구 메소. 평균은 식으로, 절반·10%는 모의 실험으로 계산해요.`)
const countText = (n: number) => (n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString('ko-KR'))
const percent = (p: number) => `${(p * 100).toFixed(p < 0.1 && p > 0 ? 2 : 1)}%`
const markerRatio = (meso: number) => Math.min(1, meso / (plan.value?.histogram.max || 1))
const markerAt = (meso: number) => `${markerRatio(meso) * 100}%`
// 오른쪽 끝에 가까운 선은 글자를 왼쪽에 붙여 그래프 밖으로 넘치지 않게 한다
const markerFlips = (meso: number) => markerRatio(meso) > 0.7
</script>

<template>
  <GameWindow class="fit" title="스타포스 기대값" sub="일반 장비 · 스타캐치 보너스 항상 적용" accent="purple" fill>
    <div class="calc-layout">
      <form class="calc-inputs" @submit.prevent novalidate>
        <section class="calc-section">
          <h3 class="calc-section-title">장비<small>최대 ★{{ max }}</small></h3>
          <div v-if="me?.main" class="calc-load">
            <label for="load-equip" class="calc-load-label">내 장비에서 불러오기</label>
            <AppSelect id="load-equip" v-model="pickedSlot" :options="equipped.length ? equipOptions : []" :placeholder="equipPlaceholder" :disabled="!equipped.length" />
          </div>
          <div class="calc-field">
            <span class="calc-label">착용 레벨</span>
            <div class="calc-chips grid" :style="{ '--cols': levelChips.length }">
              <button v-for="l in levelChips" :key="l" type="button" class="calc-chip" :aria-pressed="level === l" @click="level = l">{{ l }}</button>
            </div>
          </div>
        </section>

        <!-- 노작값은 파괴 때 흔적 복구(노작 n개 + 메소)와 12성 복구(노작 1개) 중 싼 쪽을 고르는 데 쓴다 -->
        <section class="calc-section restore">
          <MesoInput id="copy-price" v-model="copyPrice" label="노작값 · 같은 장비 1개" class="copy-input" />
        </section>

        <section class="calc-section">
          <h3 class="calc-section-title">목표<small>지금 ★ → 목표 ★</small></h3>
          <div class="star-range">
            <div class="calc-stepper">
              <button type="button" aria-label="줄이기" :disabled="from <= 0" @click="setFrom(from - 1)">−</button>
              <input :value="from" type="number" min="0" :max="max - 1" aria-label="지금 성급" @change="commitFrom">
              <button type="button" aria-label="늘리기" :disabled="from >= max - 1" @click="setFrom(from + 1)">+</button>
            </div>
            <span class="arrow" aria-hidden="true">→</span>
            <div class="calc-stepper">
              <button type="button" aria-label="줄이기" :disabled="to <= from + 1" @click="setTo(to - 1)">−</button>
              <input :value="to" type="number" :min="from + 1" :max="max" aria-label="목표 성급" @change="commitTo">
              <button type="button" aria-label="늘리기" :disabled="to >= max" @click="setTo(to + 1)">+</button>
            </div>
          </div>
          <div class="calc-chips grid" style="--cols: 6">
            <button v-for="t in TARGETS" :key="t" type="button" class="calc-chip" :disabled="t <= from || t > max" :aria-pressed="to === t" @click="setTo(t)">★{{ t }}</button>
          </div>
        </section>

        <section class="calc-section">
          <h3 class="calc-section-title">
            강화 조건
            <!-- 썬데이 정보는 비동기로 오지만 제목 줄 안에 있어서 생겨도 아래가 밀리지 않는다 -->
            <HoverInfo v-if="sunday" :title="`${sundayDay} 썬데이 메이플`" align="right" class="sunday-hover">
              <button type="button" class="sunday-toggle" :class="{ on: sundayApplied }" :aria-pressed="sundayApplied" @click="setSundayEffects(!sundayApplied)">
                <span class="lamp" aria-hidden="true" />썬데이 {{ sundayApplied ? '적용 중' : '꺼짐' }}
              </button>
              <template #info>
                <ul class="sunday-effects">
                  <li v-for="e in sundayEffects" :key="e">{{ e }}</li>
                </ul>
                <span class="sunday-tip">{{ sundayApplied ? '이번 주 효과를 자동으로 켜 뒀어요. 누르면 꺼요.' : '누르면 이번 주 효과를 다시 켜요.' }}</span>
              </template>
            </HoverInfo>
          </h3>
          <div class="calc-field">
            <span class="calc-label">파괴방지 · 고른 성급만, 비용 +200%</span>
            <div class="calc-chips grid" style="--cols: 3" role="group" aria-label="파괴방지">
              <button v-for="s in PROTECT_STARS" :key="s" type="button" class="calc-chip" :aria-pressed="protect.includes(s) && canProtect(s)" :disabled="!canProtect(s)" @click="toggleProtect(s)">★{{ s }} 시도</button>
            </div>
          </div>
          <div class="calc-field">
            <span class="calc-label">썬데이 이벤트</span>
            <div class="calc-chips">
              <button type="button" class="calc-chip" :aria-pressed="discount" @click="discount = !discount">비용 30% 할인</button>
              <button type="button" class="calc-chip" :aria-pressed="sure" @click="sure = !sure">5·10·15성 100%</button>
              <button type="button" class="calc-chip" :aria-pressed="lessDestroy" @click="lessDestroy = !lessDestroy">21성 이하 파괴 30%↓</button>
              <button type="button" class="calc-chip" :aria-pressed="restoreDiscount" @click="restoreDiscount = !restoreDiscount">복구 메소 20% 할인</button>
            </div>
          </div>
        </section>

        <div class="calc-section fold-section">
          <button type="button" class="calc-fold" :aria-expanded="showMore" @click="showMore = !showMore">{{ showMore ? '▾' : '▸' }} 세부 설정 · MVP·PC방 할인</button>
          <div v-if="showMore" class="calc-field more">
            <span class="calc-label">MVP 할인 (17성까지)</span>
            <div class="calc-chips">
              <button v-for="d in MVP_DISCOUNTS" :key="d.label" type="button" class="calc-chip" :aria-pressed="mvp === d.rate" @click="mvp = d.rate">{{ d.label }}</button>
              <button type="button" class="calc-chip" :aria-pressed="pc" @click="pc = !pc">PC방 5%</button>
            </div>
          </div>
        </div>
      </form>

      <section class="calc-result" :class="{ calculating }" aria-live="polite">
        <p class="calc-goal">Lv.{{ level }} 장비 · <span><span class="star">★</span>{{ from }} → <span class="star">★</span>{{ to }}</span></p>

        <div v-if="calcError && !calculating" class="form-error">{{ calcError }}</div>
        <template v-else-if="plan">
          <p class="calc-say">
            보통 <em>{{ formatShortNumber(plan.mean.meso) }}</em> 들어요.<br>
            <span class="s2">절반은 <em>{{ formatShortNumber(plan.p50) }}</em> 안에 끝나고, 운이 나쁘면(10%) <em class="bad">{{ formatShortNumber(plan.p90) }}</em>까지 들어요. 파괴는 평균 <em>{{ countText(plan.mean.destroys) }}번</em>.</span>
          </p>

          <div class="hist-wrap">
            <span class="calc-caption">{{ plan.runs.toLocaleString('ko-KR') }}번 해 보면 드는 메소<template v-if="plan.runs < 1000"> · 오래 걸리는 구간이라 절반·10%는 대략</template></span>
            <div class="hist">
              <i v-for="(b, i) in plan.histogram.bins" :key="i" :class="{ over: (i + 0.5) / plan.histogram.bins.length * plan.histogram.max > plan.p90 }" :style="{ height: `${(b / Math.max(...plan.histogram.bins)) * 100}%` }" />
              <span class="marker" :class="{ flip: markerFlips(plan.p50) }" :style="{ left: markerAt(plan.p50) }"><span>절반 {{ formatShortNumber(plan.p50) }}</span></span>
              <span class="marker m90" :class="{ flip: markerFlips(plan.p90) }" :style="{ left: markerAt(plan.p90) }"><span>10% {{ formatShortNumber(plan.p90) }}</span></span>
            </div>
            <div class="axis"><span>0</span><span>{{ formatShortNumber(plan.histogram.max / 2) }}</span><span>{{ formatShortNumber(plan.histogram.max) }}+</span></div>
          </div>

          <div class="calc-nums">
            <div class="calc-num"><small>평균 누르는 횟수</small><b>{{ Math.round(plan.mean.tries).toLocaleString('ko-KR') }}번</b></div>
            <div class="calc-num"><small>한 번도 안 터질 확률</small><b>{{ percent(plan.noDestroy) }}</b></div>
            <div class="calc-num"><small>복구에 드는 노작</small><b>평균 {{ countText(plan.mean.copies) }}개</b><small>{{ copyPrice ? '노작값 포함' : '노작값 빼고 계산' }}</small></div>
          </div>

          <div class="restore-plan">
            <span class="calc-caption">{{ plan.restores.length ? '터지면 이렇게 하는 게 이득이에요 · 누르면 비용' : '이 구간은 파괴되지 않아요' }}</span>
            <template v-if="plan.restores.length">
              <ul>
                <li v-for="(g, gi) in restoreGroups" :key="g.from">
                  <button type="button" :class="g.choice" :aria-pressed="restorePicked === gi" @click="restorePicked = gi">
                    {{ groupLabel(g).range }} 파괴 → <b>{{ groupLabel(g).action }}</b>
                  </button>
                </li>
              </ul>
              <p class="restore-detail" aria-live="polite">
                <span v-for="r in restoreGroups[restorePicked]?.items" :key="r.star">★{{ r.star }} · {{ restoreDetail(r) }}</span>
              </p>
            </template>
          </div>

          <button type="button" class="fold" :aria-expanded="showStages" @click="showStages = !showStages">{{ showStages ? '▾' : '▸' }} ★별 표 · 성공·파괴 확률, 1번 비용</button>
          <div v-if="showStages" class="table-wrap">
            <table class="stages">
              <thead><tr><th>구간</th><th>성공</th><th>파괴</th><th>1번 비용</th><th>넘기는 데 평균</th></tr></thead>
              <tbody>
                <tr v-for="s in plan.stages" :key="s.star" :class="{ hot: s.star === priciest }">
                  <td><span class="star">★</span>{{ s.star }} → {{ s.star + 1 }}</td>
                  <td class="gain">{{ percent(s.success) }}</td>
                  <td :class="s.destroy ? 'loss' : 'dim'">{{ s.destroy ? percent(s.destroy) : '·' }}</td>
                  <td>{{ formatShortNumber(s.cost) }}</td>
                  <td>{{ Math.round(1 / s.success) }}번</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div v-else class="skeleton calc-skeleton" />

        <div class="calc-src">
          <SourceBadge type="api" /><span>15~29성 확률·파괴방지 비용</span>
          <SourceBadge type="calc" />
          <HoverInfo title="위키 기준인 값" align="left" class="src-info">
            <span class="src-more">{{ usesWiki ? '0~14성 확률·' : '' }}스타캐치 보너스·비용식·복구 메소는 위키 기준 ⓘ</span>
            <template #info><span>{{ srcNote }}</span></template>
          </HoverInfo>
        </div>
      </section>
    </div>
  </GameWindow>
</template>

<style scoped>
/* 새 값으로 계산하는 동안 이전 결과를 흐리게 둔다(자리는 그대로) */
.calc-result.calculating > :not(.calc-src) {
  opacity: 0.55;
  transition: opacity 0.2s ease 0.15s;
}
.calc-skeleton {
  height: 220px;
}
/* 파괴 복구는 돈이 크게 갈리는 칸이라 붉은 기운으로 눈에 띄게 */
.restore {
  gap: 8px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--loss) 7%, transparent), transparent);
  padding-block: 12px;
}
.copy-input :deep(.label) {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
}
.star-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.star-range .arrow {
  color: var(--sub);
}
.sunday-hover {
  margin-left: auto;
}
.sunday-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease, background var(--fast) ease;
}
.sunday-toggle:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.sunday-toggle.on {
  background: color-mix(in srgb, var(--gain) 10%, transparent);
  border-color: color-mix(in srgb, var(--gain) 50%, transparent);
  color: var(--gain);
}
.sunday-toggle .lamp {
  width: 7px;
  height: 7px;
  background: var(--panel-line);
  border-radius: 50%;
  transition: background var(--fast) ease, box-shadow var(--fast) ease;
}
.sunday-toggle.on .lamp {
  background: var(--gain);
  box-shadow: 0 0 6px var(--gain);
}
.sunday-effects {
  margin: 2px 0 0;
  padding-left: 16px;
  color: var(--text);
  font-family: var(--f-body);
}
.sunday-tip {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
}
.restore-plan {
  display: grid;
  gap: 6px;
}
.restore-plan ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.restore-plan button {
  min-height: 32px;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
}
.restore-plan button.twelve {
  background: color-mix(in srgb, var(--api) 8%, transparent);
  border-color: color-mix(in srgb, var(--api) 45%, transparent);
}
.restore-plan button[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px var(--gold);
  color: var(--text);
}
.restore-plan button.twelve[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px var(--api);
}
.restore-plan b {
  color: var(--gold);
  font-weight: 700;
}
.restore-plan .twelve b {
  color: var(--api);
}
/* 고른 칩의 성급별 비용. 높이를 잡아 둬서 다른 칩을 눌러도 아래가 들썩이지 않는다 */
.restore-detail {
  display: grid;
  align-content: start;
  height: 74px;
  margin: 0;
  padding: 6px 10px;
  overflow-y: auto;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
  line-height: 1.6;
  scrollbar-width: thin;
}
.src-more {
  cursor: help;
}
.fold-section {
  gap: 0;
  padding: 0;
}
.fold-section .more {
  padding: 0 16px 16px;
}
.star {
  color: var(--gold);
}
.fold {
  align-self: flex-start;
  padding: 8px 0 0;
  background: none;
  border: 0;
  border-top: 1px dashed var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.hist-wrap {
  display: grid;
  gap: 6px;
}
.hist {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 96px;
  margin-top: 18px;
  padding: 0 4px;
  border-bottom: 1px solid var(--tip-line);
}
.hist i {
  flex: 1;
  background: color-mix(in srgb, var(--calc) 55%, transparent);
  border-radius: 3px 3px 0 0;
}
.hist i.over {
  background: color-mix(in srgb, var(--loss) 45%, transparent);
}
.marker {
  position: absolute;
  top: -6px;
  bottom: 0;
  border-left: 2px dashed var(--gold);
}
.marker span {
  position: absolute;
  top: -16px;
  left: 4px;
  color: var(--gold);
  font-size: 11px;
  white-space: nowrap;
}
.marker.flip span {
  right: 4px;
  left: auto;
}
.marker.m90 {
  border-color: var(--loss);
}
.marker.m90 span {
  color: var(--loss);
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--tip-line);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.table-wrap {
  overflow-x: auto;
}
.stages {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.stages th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
  text-align: right;
}
.stages td {
  padding: 6px 8px;
  border-bottom: 1px solid rgb(58 67 102 / 0.5);
  text-align: right;
}
.stages th:first-child,
.stages td:first-child {
  text-align: left;
}
.stages tr.hot td {
  background: color-mix(in srgb, var(--gold) 9%, transparent);
}
.stages tr.hot td:first-child {
  box-shadow: inset 3px 0 0 var(--gold);
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.dim {
  color: var(--tip-line);
}
</style>
