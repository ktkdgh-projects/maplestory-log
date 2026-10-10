<script setup lang="ts">
import type { CharacterDetail, EquipmentItem, PotentialOptionTable } from '#shared/types'
import { POTENTIAL_GRADES, POTENTIAL_PARTS, RESET_METHODS, type PotentialGrade } from '#shared/data/potential'

useHead({ title: '잠재 기대값 · 메이플스토리로그' })

const route = useRoute()
const { me } = await useMe()

const LEVELS = [140, 160, 200, 250]
const STATS = ['STR', 'DEX', 'INT', 'LUK', '최대 HP']

const queryNumber = (key: string) => (Number(route.query[key]) > 0 ? Number(route.query[key]) : null)
const gradeIndex = (grade: unknown) => POTENTIAL_GRADES.indexOf(grade as PotentialGrade)

const additional = ref(route.query.part === 'additional')
const methods = computed(() => RESET_METHODS.filter(m => m.additional === additional.value))
const methodId = ref(methods.value[0]!.id)
watch(additional, () => {
  methodId.value = methods.value[0]!.id
  // 불러온 장비면 윗잠·에디셔널 등급이 달라서 바꾼 쪽 등급으로 다시 채운다
  if (pickedSlot.value) loadItem(pickedSlot.value)
})
const method = computed(() => methods.value.find(m => m.id === methodId.value) ?? methods.value[0]!)

const part = ref<string>(partOfSlot(String(route.query.slot ?? '')) ?? '모자')
const level = ref(queryNumber('level') ?? 200)
const from = ref(gradeIndex(route.query.grade) >= 0 ? gradeIndex(route.query.grade) : 2)
const to = ref(3)
watch(from, (value) => {
  if (to.value < value) to.value = value
})
const stat = ref('STR')
const stack = ref(0)

// 내 장비에서 불러오기: 대표 캐릭터가 지금 낀 장비로 부위·레벨·등급을 채운다
const equipped = ref<EquipmentItem[]>([])
const pickedSlot = ref(String(route.query.slot ?? ''))
onMounted(async () => {
  const name = me.value?.main?.name
  if (!name) return
  const detail = await $fetch<CharacterDetail>(`/api/character/${encodeURIComponent(name)}`).catch(() => null)
  equipped.value = (detail?.presets[detail.presetNo - 1] ?? []).filter(i => partOfSlot(i.slot))
})
function loadItem(slot: string) {
  const item = equipped.value.find(i => i.slot === slot)
  if (!item) return
  part.value = partOfSlot(item.slot)!
  if (item.requiredLevel) level.value = item.requiredLevel
  const grade = gradeIndex(additional.value ? item.additionalGrade : item.potentialGrade)
  if (grade >= 0) from.value = grade
  to.value = 3
}
watch(pickedSlot, loadItem)
watch(equipped, () => {
  if (pickedSlot.value) loadItem(pickedSlot.value)
})

// 목표 등급의 공식 옵션 확률표
const table = ref<PotentialOptionTable | null>(null)
const tableError = ref('')
const tableQuery = computed(() => ({ cube: method.value.cubeItemId, grade: to.value + 1, part: POTENTIAL_PARTS.indexOf(part.value as typeof POTENTIAL_PARTS[number]) + 1, level: level.value }))
watch(tableQuery, async (query) => {
  tableError.value = ''
  try {
    table.value = await $fetch<PotentialOptionTable>('/api/calc/potential-options', { query })
  }
  catch (e) {
    table.value = null
    tableError.value = errorMessage(e)
  }
}, { immediate: true })

const presets = computed(() => (table.value ? goalPresets(table.value, stat.value) : []))
const goalLabel = ref<string | null>(null)
const goal = computed(() => presets.value.find(g => g.label === goalLabel.value) ?? null)
// 부위나 등급이 바뀌어 같은 목표가 없으면 '등급만'으로 돌린다
watch(presets, (list) => {
  if (goalLabel.value && !list.some(g => g.label === goalLabel.value)) goalLabel.value = null
})

// 직접 조합: 세 줄에 원하는 옵션을 골라 그 조합이 뜰 확률을 본다. 비운 줄은 아무거나
const goalMode = ref<'preset' | 'custom'>('preset')
const picks = ref<(string | null)[]>([null, null, null])
const ordered = ref(false)
const comboList = (line: number) => (table.value ? comboOptions(table.value, ordered.value ? line : null) : [])
// 부위·등급이 바뀌거나 순서 방식을 바꿔 고를 수 없게 된 옵션은 비운다
watch([table, ordered], () => {
  picks.value = picks.value.map((p, i) => (p && comboList(i).includes(p) ? p : null))
})
const customGoal = computed(() => goalMode.value === 'custom' && picks.value.some(Boolean))

const chance = computed(() => {
  if (!table.value) return null
  if (goalMode.value === 'custom') return customGoal.value ? comboChance(table.value, picks.value, ordered.value) : null
  return goal.value ? optionChance(table.value, goal.value) : null
})
const ready = computed(() => to.value > from.value || chance.value !== null)
const plan = computed(() => (ready.value && (chance.value === null || chance.value > 0) ? planPotential(method.value, level.value, from.value, to.value, stack.value, chance.value) : null))
const ceilingNow = computed(() => (to.value > from.value ? method.value.ceiling[from.value]! : null))

// 결과 숫자는 억 단위로 줄여 읽기 쉽게
const count = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}번`
const withMeso = (tries: number, meso: number | null) => (meso === null ? count(tries) : `${count(tries)} · ${formatShortNumber(meso)}`)
const gradeStyle = (i: number) => ({ '--grade': potentialGradeColor(POTENTIAL_GRADES[i]!) ?? 'var(--tip-line)' })
const goalLabelText = computed(() => {
  if (goalMode.value === 'custom') return customGoal.value ? picks.value.filter(Boolean).join(' · ') : null
  return goal.value?.label ?? null
})
const goalText = computed(() => `${POTENTIAL_GRADES[from.value]}${to.value > from.value ? ` → ${POTENTIAL_GRADES[to.value]}` : ''}${goalLabelText.value ? ` + ${goalLabelText.value}` : ''}`)
</script>

<template>
  <GameWindow class="fit" title="잠재 기대값" sub="공식 확률표로 계산" accent="purple" fill>
    <div class="calc-layout">
      <form class="calc-inputs" @submit.prevent>
        <section class="calc-section">
          <h3 class="calc-section-title">장비</h3>
          <label v-if="equipped.length" class="calc-load">
            <span class="calc-load-label">내 장비에서 불러오기</span>
            <select v-model="pickedSlot" class="field-input">
              <option value="">직접 고르기</option>
              <option v-for="i in equipped" :key="i.slot" :value="i.slot">{{ i.slot }} · {{ i.name }}</option>
            </select>
          </label>
          <label class="calc-field">
            <span class="calc-label">부위</span>
            <select id="calc-part" v-model="part" class="field-input">
              <option v-for="p in POTENTIAL_PARTS" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <div class="calc-field">
            <span class="calc-label">착용 레벨</span>
            <div class="calc-chips grid" style="--cols: 4">
              <button v-for="l in LEVELS" :key="l" type="button" class="calc-chip" :aria-pressed="level === l" @click="level = l">{{ l }}</button>
            </div>
          </div>
        </section>

        <section class="calc-section">
          <h3 class="calc-section-title">재설정</h3>
          <div class="calc-seg wide" role="group" aria-label="잠재 종류">
            <button type="button" :aria-pressed="!additional" @click="additional = false">윗잠</button>
            <button type="button" :aria-pressed="additional" @click="additional = true">에디셔널</button>
          </div>
          <div class="calc-field">
            <span class="calc-label">방법</span>
            <div class="calc-chips">
              <button v-for="m in methods" :key="m.id" type="button" class="calc-chip" :aria-pressed="methodId === m.id" @click="methodId = m.id">{{ m.label }}</button>
            </div>
          </div>
        </section>

        <section class="calc-section">
          <h3 class="calc-section-title">등급</h3>
          <div class="grade-row">
            <span class="calc-label">지금</span>
            <div class="grade-chips">
              <button v-for="(g, i) in POTENTIAL_GRADES" :key="g" type="button" class="calc-chip grade" :style="gradeStyle(i)" :aria-pressed="from === i" @click="from = i">{{ g }}</button>
            </div>
          </div>
          <div class="grade-row">
            <span class="calc-label">목표</span>
            <div class="grade-chips">
              <button v-for="(g, i) in POTENTIAL_GRADES" :key="g" type="button" class="calc-chip grade" :style="gradeStyle(i)" :disabled="i < from" :aria-pressed="to === i" @click="to = i">{{ g }}</button>
            </div>
          </div>
          <div v-if="ceilingNow" class="calc-field">
            <span class="calc-label">쌓인 천장 · {{ POTENTIAL_GRADES[from] }}, 최대 {{ ceilingNow }}번</span>
            <div class="calc-stepper half">
              <button type="button" aria-label="줄이기" :disabled="stack <= 0" @click="stack = Math.max(0, stack - 1)">−</button>
              <input v-model.number="stack" type="number" min="0" :max="ceilingNow - 1" aria-label="쌓인 천장 횟수">
              <button type="button" aria-label="늘리기" :disabled="stack >= ceilingNow - 1" @click="stack = Math.min(ceilingNow - 1, stack + 1)">+</button>
            </div>
          </div>
        </section>

        <section class="calc-section">
          <h3 class="calc-section-title">목표 옵션<small>{{ part }}에 뜨는 것만</small></h3>
          <div class="calc-seg wide" role="group" aria-label="목표 고르는 방법">
            <button type="button" :aria-pressed="goalMode === 'preset'" @click="goalMode = 'preset'">추천 목표</button>
            <button type="button" :aria-pressed="goalMode === 'custom'" @click="goalMode = 'custom'">직접 조합</button>
          </div>
          <template v-if="goalMode === 'preset'">
            <div class="calc-seg wide small" role="group" aria-label="주스탯">
              <button v-for="s in STATS" :key="s" type="button" :aria-pressed="stat === s" @click="stat = s">{{ s === '최대 HP' ? 'HP' : s }}</button>
            </div>
            <div class="calc-chips">
              <button type="button" class="calc-chip" :aria-pressed="goalLabel === null" @click="goalLabel = null">등급만</button>
              <button v-for="g in presets" :key="g.label" type="button" class="calc-chip" :aria-pressed="goalLabel === g.label" @click="goalLabel = g.label">{{ g.label }}</button>
            </div>
          </template>
          <template v-else>
            <div class="calc-seg wide small" role="group" aria-label="줄 순서">
              <button type="button" :aria-pressed="!ordered" @click="ordered = false">순서 상관없이</button>
              <button type="button" :aria-pressed="ordered" @click="ordered = true">줄 순서대로</button>
            </div>
            <div class="combo">
              <label v-for="(_, i) in picks" :key="i" class="combo-line">
                <span class="combo-no" :class="{ on: picks[i] }">{{ i + 1 }}</span>
                <select v-model="picks[i]" class="field-input" :aria-label="ordered ? `${i + 1}번째 줄 옵션` : `옵션 ${i + 1}`">
                  <option :value="null">아무거나</option>
                  <option v-for="t in comboList(i)" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
            </div>
            <p class="calc-hint">{{ ordered ? '고른 옵션이 그 줄에 그대로 떠야 해요.' : '고른 옵션이 세 줄 중 어디에든 뜨면 돼요.' }} 비운 칸은 아무 옵션이나 괜찮다는 뜻이에요.</p>
          </template>
          <p v-if="tableError" class="form-error">{{ tableError }}</p>
        </section>
      </form>

      <section class="calc-result" aria-live="polite">
        <p class="calc-goal"><b>{{ part }}</b> · Lv.{{ level }} · {{ additional ? '에디셔널' : '윗잠' }} {{ method.label }}<br><span>{{ goalText }}</span></p>

        <template v-if="plan">
          <p class="calc-say">
            보통 <em>{{ withMeso(plan.mean.tries, plan.mean.meso) }}</em> 들어요.<br>
            <span class="s2">절반은 <em>{{ withMeso(plan.p50.tries, plan.p50.meso) }}</em> 안에 끝나고, 운이 나쁘면(10%) <em class="bad">{{ withMeso(plan.p90.tries, plan.p90.meso) }}</em>까지 들어요.</span>
          </p>
          <div v-if="plan.tierTries && plan.optionTries" class="split">
            <span class="calc-caption">어디에 몇 번 쓰는지 (평균)</span>
            <div class="stack">
              <div :style="{ flex: plan.tierTries, ...gradeStyle(from) }">등급 올리기 {{ count(plan.tierTries) }}</div>
              <div :style="{ flex: plan.optionTries, ...gradeStyle(to) }">옵션 맞추기 {{ count(plan.optionTries) }}</div>
            </div>
          </div>
          <div class="calc-nums">
            <div v-if="plan.chance !== null" class="calc-num"><small>한 번에 목표 옵션이 뜰 확률</small><b>{{ (plan.chance * 100).toFixed(plan.chance < 0.01 ? 3 : 2) }}%</b><small>{{ Math.round(1 / plan.chance).toLocaleString('ko-KR') }}번에 한 번</small></div>
            <div class="calc-num"><small>1번 비용 ({{ POTENTIAL_GRADES[to] }})</small><b>{{ plan.costPerTry ? formatShortNumber(plan.costPerTry) : '큐브 1개' }}</b><small>{{ method.meso ? '공식 비용표' : '큐브는 메소로 못 사요' }}</small></div>
            <div v-if="to > from" class="calc-num"><small>등급 올리기 최대 (천장)</small><b>{{ count(plan.worstTier) }}</b><small>{{ stack ? `쌓인 ${stack}번 반영` : '천장까지 다 돌 때' }}</small></div>
          </div>
        </template>
        <p v-else-if="chance === 0" class="muted calc-empty">이 부위·등급에서는 이 목표가 나올 수 없어요.</p>
        <p v-else class="muted calc-empty">목표 등급을 높이거나 목표 옵션을 골라 주세요.</p>

        <div class="calc-src">
          <SourceBadge type="api" /><span>등급 확률·천장·비용·옵션 확률은 넥슨 공식 확률 페이지·공지 기준</span>
          <SourceBadge type="calc" /><span>2만 번 모의 실험</span>
        </div>
      </section>
    </div>
  </GameWindow>
</template>

<style scoped>
/* 지금·목표 등급은 네 칸을 같은 너비로 맞춰 위아래가 줄 맞게 */
.grade-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.grade-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.grade-chips .calc-chip {
  padding: 0;
  color: color-mix(in srgb, var(--grade) 70%, var(--sub));
}
.calc-chip.grade[aria-pressed="true"] {
  background: color-mix(in srgb, var(--grade) 16%, transparent);
  border-color: var(--grade);
  color: var(--grade);
}
/* 직접 조합: 번호 동그라미 + 옵션 고르기. 고른 줄은 번호에 불이 들어온다 */
.combo {
  display: grid;
  gap: 6px;
}
.combo-line {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.combo-no {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  color: var(--sub);
  font-size: 11px;
  font-weight: 700;
}
.combo-no.on {
  background: rgb(242 193 78 / 0.12);
  border-color: var(--gold);
  color: var(--gold);
}
.half {
  max-width: 50%;
}
.split {
  display: grid;
  gap: 6px;
}
/* 등급 올리기와 옵션 맞추기에 쓰는 횟수를 그 등급 색 막대로 나눠 보여준다 */
.stack {
  display: flex;
  overflow: hidden;
  height: 28px;
  border-radius: 8px;
  color: #10131f;
  font-size: 12px;
  font-weight: 800;
}
.stack div {
  display: grid;
  place-items: center;
  min-width: 0;
  overflow: hidden;
  background: var(--grade);
  white-space: nowrap;
}
</style>
