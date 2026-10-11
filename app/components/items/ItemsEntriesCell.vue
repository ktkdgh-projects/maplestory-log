<script setup lang="ts">
import type { ItemPurchase } from '#shared/types'

// 가계부에는 합계가 아니라 건마다 그 날짜로 들어간다
const props = withDefaults(defineProps<{
  label: string
  name: string
  entries: ItemPurchase[]
  intro: string
  reference?: number
  referenceDays?: ItemPurchase[]
  shared?: boolean
  estimated?: boolean
  ocid?: string | null
}>(), { reference: 0, referenceDays: () => [], ocid: null })
const emit = defineEmits<{ save: [entries: ItemPurchase[]] }>()

const open = ref(false)
const uid = useId()
const today = kstToday()
const date = ref(today)
const amount = ref<number | null>(null)
const hint = ref('')
const total = computed(() => props.entries.reduce((sum, e) => sum + e.amount, 0))
// 표는 억 단위 소수 둘째 자리(100만)까지라, 그 자리까지 같으면 이미 채운 것으로 본다
const SHOWN_UNIT = 1e6
const same = (a: number, b: number) => Math.round(a / SHOWN_UNIT) === Math.round(b / SHOWN_UNIT)
const showReference = computed(() => !!props.reference && !same(props.reference, total.value))
const filled = (day: ItemPurchase) => props.entries.some(e => e.date === day.date && same(e.amount, day.amount))

const sorted = (list: ItemPurchase[]) => [...list].sort((a, b) => a.date.localeCompare(b.date))
function add() {
  if (!amount.value) {
    hint.value = '금액을 만 단위로 적어 주세요.'
    return
  }
  hint.value = ''
  emit('save', sorted([...props.entries, { date: date.value || today, amount: amount.value }]))
  amount.value = null
}
const { ask } = useConfirm()
async function remove(index: number) {
  const item = props.entries[index]!
  if (!await ask({ title: '내역 지우기', name: `${props.name} ${props.label} 내역`, detail: formatDay(item.date), amount: -item.amount, note: '지우면 가계부에서도 이 금액이 빠져요.' })) return
  emit('save', props.entries.filter((_, i) => i !== index))
}
// 같은 날 적은 건이 있으면 기록 값으로 바꾼다
function useDay(day: ItemPurchase) {
  emit('save', sorted([...props.entries.filter(e => e.date !== day.date), { date: day.date, amount: Math.round(day.amount) }]))
}
// 적어 둔 내역을 기록으로 통째로 바꾸므로, 이미 적은 게 있으면 먼저 묻는다
async function useAllDays() {
  if (props.entries.length && !await ask({
    title: '기록대로 채우기',
    name: `${props.name} ${props.label} 내역`,
    detail: `적어 둔 ${props.entries.length}건 → 기록 ${props.referenceDays.length}건`,
    note: '직접 적은 내역은 지워지고 강화 기록의 날짜별 값으로 바뀌어요.',
    action: '바꾸기',
  })) return
  emit('save', props.referenceDays.map(d => ({ date: d.date, amount: Math.round(d.amount) })))
}
const reviewLink = (day: string) => (props.ocid ? { path: '/review', query: { ocid: props.ocid, date: day } } : null)
const hasLinks = computed(() => !!props.ocid && props.label !== '구매')
</script>

<template>
  <div class="entries">
    <button type="button" class="total" :class="{ blank: !total }" :aria-label="`${name} ${label} 내역 열기`" @click="open = true">
      {{ total ? formatEok(total) : '-' }}
    </button>
    <div class="sub-line">
      <button v-if="showReference" type="button" class="ref" @click="open = true">
        기록 {{ estimated ? '약 ' : '' }}{{ formatEok(reference) }}
      </button>
      <button v-else-if="shared" type="button" class="shared" @click="open = true">기록 나눌 수 없음</button>
      <button type="button" class="count" @click="open = true">{{ entries.length ? `${entries.length}건` : '+ 내역' }}</button>
    </div>

    <AppModal v-model="open" :title="`${name} ${label} 내역`" :width="460">
      <p class="muted small">{{ intro }}</p>
      <ol v-if="entries.length" class="list">
        <li v-for="(e, i) in entries" :key="`${e.date}-${i}`" :class="{ linked: hasLinks }">
          <span class="date">{{ formatDay(e.date) }}</span>
          <b>{{ formatKoreanNumber(e.amount) }}</b>
          <template v-if="hasLinks">
            <NuxtLink v-if="reviewLink(e.date)" :to="reviewLink(e.date)!" class="go" @click="open = false">이날 결산 →</NuxtLink>
            <span v-else />
          </template>
          <button type="button" class="icon-btn" :aria-label="`${formatDay(e.date)} 내역 지우기`" @click="remove(i)">×</button>
        </li>
      </ol>
      <p v-else class="muted small">아직 적은 내역이 없어요.</p>

      <form class="add" novalidate @submit.prevent="add">
        <div class="add-date">
          <span class="add-label">날짜</span>
          <DatePicker v-model="date" :max="today" field />
        </div>
        <MesoInput :id="uid" v-model="amount" label="금액" @update:model-value="hint = ''" />
        <button class="btn compact add-btn">+ 추가</button>
      </form>
      <!-- 금액 없이 누르면 같은 자리에 안내가 떠서 아래가 밀리지 않는다 -->
      <p class="hint-line" role="status">{{ hint || ' ' }}</p>
      <p class="sum">합계 <b>{{ formatKoreanNumber(total) }}</b></p>

      <p v-if="shared" class="muted small">같은 이름 장비가 여러 줄이라 강화 기록을 어느 줄에 붙일지 알 수 없어요. 직접 적어 주세요.</p>
      <section v-if="referenceDays.length" class="records">
        <div class="records-head">
          <b>강화 기록으로 센 값</b>
          <button type="button" class="link" @click="useAllDays">기록대로 날짜별로 채우기</button>
        </div>
        <p v-if="estimated" class="muted small">추정값이에요 · MVP 할인과 복구 메소는 넣고 노작값은 빼고 셌어요.</p>
        <ol class="list">
          <li v-for="d in referenceDays" :key="d.date" class="linked">
            <span class="date">{{ formatDay(d.date) }}</span>
            <b class="muted-b">{{ estimated ? '약 ' : '' }}{{ formatKoreanNumber(d.amount) }}</b>
            <NuxtLink v-if="reviewLink(d.date)" :to="reviewLink(d.date)!" class="go" @click="open = false">이날 결산 →</NuxtLink>
            <span v-else />
            <button type="button" class="use" :disabled="filled(d)" @click="useDay(d)">{{ filled(d) ? '넣음' : '넣기' }}</button>
          </li>
        </ol>
      </section>
    </AppModal>
  </div>
</template>

<style scoped>
.entries {
  display: grid;
  padding: 3px 0;
}
.total {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: pointer;
}
.total:hover {
  background: var(--bar);
  border-color: var(--panel-line);
}
.total.blank {
  color: var(--panel-line);
}
.sub-line {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  min-height: 15px;
  padding: 0 9px;
  font-size: 11px;
  line-height: 15px;
}
.ref,
.count,
.shared {
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  cursor: pointer;
}
.count,
.shared {
  color: var(--sub);
}
.ref:hover,
.count:hover,
.shared:hover {
  text-decoration: underline;
}
.small {
  margin: 0;
}
.list {
  display: grid;
  gap: 4px;
  max-height: 300px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.list li {
  display: grid;
  grid-template-columns: minmax(64px, auto) minmax(0, 1fr) 36px;
  align-items: center;
  gap: 10px;
  padding: 4px 4px 4px 10px;
  background: rgb(255 255 255 / 0.03);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
.list li.linked {
  grid-template-columns: minmax(64px, auto) minmax(0, 1fr) auto 44px;
}
.date {
  color: var(--sub);
  font-size: 13px;
}
.list b {
  color: var(--gold);
  font-family: var(--f-title);
  font-weight: 400;
}
.list .muted-b {
  color: var(--sub);
}
.go {
  color: var(--gain);
  font-size: 12px;
  text-decoration: none;
}
.go:hover {
  text-decoration: underline;
}
.icon-btn {
  justify-self: end;
  width: 36px;
  height: 36px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--sub);
  font-size: 16px;
  cursor: pointer;
}
.icon-btn:hover {
  color: var(--loss);
}
.use {
  min-height: 30px;
  padding: 2px 0;
  background: none;
  border: 1px solid color-mix(in srgb, var(--api) 50%, transparent);
  border-radius: 6px;
  color: var(--api);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.use:disabled {
  border-color: var(--panel-line);
  color: var(--sub);
  cursor: default;
}
/* 날짜·금액은 이름 줄과 안내 줄까지 같은 높이라, 버튼은 입력칸 줄에 맞춰 내린다 */
.add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
}
.add-date {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.add-date :deep(.trigger) {
  min-height: 44px;
}
.add-label {
  color: var(--sub);
  font-size: 13px;
}
.add-btn {
  min-height: 44px;
  margin-top: calc(13px * 1.65 + 3px);
}
.hint-line {
  min-height: 18px;
  margin: -6px 0 0;
  color: var(--loss);
  font-size: 12.5px;
  line-height: 18px;
}
.sum {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
  text-align: right;
}
.sum b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.records {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--panel-line);
}
.records-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  font-size: 13px;
}
.link {
  min-height: 32px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
@media (max-width: 480px) {
  .add {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .add-btn {
    grid-column: 1 / -1;
    margin-top: 0;
  }
}
</style>
