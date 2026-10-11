<script setup lang="ts">
import type { HuntEntry, HuntInput } from '#shared/types'
import { mesoPerHour } from '#shared/calc/ledger'

const props = defineProps<{ date: string, entry: HuntEntry | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const e = props.entry
const form = reactive({ minutes: e?.minutes ?? null, fragments: e?.fragments || null, traces: e?.traces || null, memo: e?.memo ?? '' } as { minutes: number | null, fragments: number | null, traces: number | null, memo: string })
const meso = ref<number | null>(e?.meso || null)
const busy = ref(false)
const failure = ref('')
const perHour = computed(() => mesoPerHour(meso.value ?? 0, form.minutes ?? 0))
// 숫자 칸을 비우면 ''가 들어오므로 0으로 본다
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

async function submit() {
  const body: HuntInput = { date: e?.date ?? props.date, meso: meso.value ?? 0, fragments: num(form.fragments), traces: num(form.traces), minutes: form.minutes, memo: form.memo.trim() || null }
  if (!body.meso && !body.fragments && !body.traces) {
    failure.value = '번 메소나 조각·주흔 중 하나는 적어 주세요.'
    return
  }
  busy.value = true
  failure.value = ''
  try {
    if (props.entry) await $fetch(`/api/ledger/hunts/${props.entry.id}`, { method: 'PUT', body })
    else await $fetch('/api/ledger/hunts', { method: 'POST', body })
    emit('saved')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit" novalidate>
    <div class="field">
      <span class="label">소재비 개수 <small>(1개 = {{ SOJAEBI_MINUTES }}분)</small><b class="per-hour" :class="{ off: !perHour }">시간당 {{ perHour ? formatKoreanNumber(perHour) : '-' }}</b></span>
      <div class="sojaebi" role="radiogroup" aria-label="소재비 개수">
        <button
          v-for="n in SOJAEBI_MAX"
          :key="n"
          type="button"
          role="radio"
          class="count"
          :class="{ on: form.minutes === n * SOJAEBI_MINUTES }"
          :aria-checked="form.minutes === n * SOJAEBI_MINUTES"
          @click="form.minutes = form.minutes === n * SOJAEBI_MINUTES ? null : n * SOJAEBI_MINUTES"
        >
          {{ n }}
        </button>
      </div>
    </div>
    <div class="amounts">
      <MesoInput id="hunt-meso" v-model="meso" label="번 메소" @input="failure = ''" />
      <label v-for="d in HUNT_DROPS" :key="d.key" :for="`hunt-${d.key}`" class="drop">
        <span class="label"><i :style="{ background: d.color }" />{{ d.short }}</span>
        <input :id="`hunt-${d.key}`" v-model.number="form[d.key]" type="number" min="0" inputmode="numeric" class="field-input" placeholder="0" :title="d.label" @input="failure = ''">
      </label>
    </div>
    <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
    <div class="bottom">
      <label for="hunt-memo" class="sr-only">메모</label>
      <input id="hunt-memo" v-model="form.memo" class="field-input" maxlength="200" placeholder="메모 · 사냥터 등 (선택)">
      <button type="button" class="btn ghost compact" @click="emit('cancel')">취소</button>
      <button class="btn compact" :disabled="busy">{{ entry ? '고치기' : '기록하기' }}</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--bar);
  border: 1px solid var(--api);
  border-radius: 10px;
  animation: rise-in 0.3s var(--ease-out);
}
.form :deep(.field-input) {
  min-height: 36px;
}
.form :deep(.meso-input .hint) {
  min-height: 0;
}
.label small {
  color: var(--tip-line);
  font-size: 11px;
}
.sojaebi {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}
.count {
  height: 34px;
  padding: 0;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 15px;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease, transform var(--fast) var(--ease-spring);
}
.count:hover {
  border-color: var(--api);
  color: var(--text);
}
.count:active {
  transform: scale(0.92);
}
.count.on {
  background: var(--api);
  border-color: var(--api);
  color: var(--bar);
}
.field,
.drop {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--sub);
  font-size: 13px;
  white-space: nowrap;
}
.label i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  transform: rotate(45deg);
}
.per-hour.off {
  visibility: hidden;
}
.hint {
  height: 18px;
  margin: 0;
  overflow: hidden;
  color: var(--loss);
  font-size: 12.5px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
}
.hint.show {
  opacity: 1;
}
.per-hour {
  margin-left: auto;
  color: var(--api);
  font-family: var(--f-title);
  font-size: 13px;
  font-weight: 400;
}
.amounts {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}
.drop input {
  text-align: right;
}
.bottom {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bottom .field-input {
  flex: 1;
}
@media (max-width: 480px) {
  .sojaebi {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .count {
    height: 36px;
  }
  .amounts {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .amounts > :first-child {
    grid-column: 1 / -1;
  }
  .bottom {
    flex-wrap: wrap;
  }
  .bottom .field-input {
    flex-basis: 100%;
  }
  .bottom .btn {
    flex: 1;
  }
}
</style>
