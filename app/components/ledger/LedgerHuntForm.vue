<script setup lang="ts">
import type { HuntEntry, HuntInput } from '#shared/types'

const props = defineProps<{ date: string, entry: HuntEntry | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const { id: _id, ...editing } = props.entry ?? {}
const form = reactive<HuntInput>({ date: props.date, meso: 0, fragments: 0, traces: 0, minutes: null, memo: null, ...editing })
const meso = ref<number | null>(form.meso || null)
const busy = ref(false)
const failure = ref('')
const perHour = computed(() => mesoPerHour(meso.value ?? 0, form.minutes ?? 0))

async function submit() {
  busy.value = true
  failure.value = ''
  try {
    const body = { ...form, meso: meso.value ?? 0 }
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
  <form class="form" @submit.prevent="submit">
    <div class="field">
      <span class="label">소재비 개수 <small>(1개 = {{ SOJAEBI_MINUTES }}분)</small><b v-if="perHour" class="per-hour">시간당 {{ formatKoreanNumber(perHour) }}</b></span>
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
      <MesoInput id="hunt-meso" v-model="meso" label="번 메소" />
      <label v-for="d in HUNT_DROPS" :key="d.key" :for="`hunt-${d.key}`" class="drop">
        <span class="label"><i :style="{ background: d.color }" />{{ d.short }}</span>
        <input :id="`hunt-${d.key}`" v-model.number="form[d.key]" type="number" min="0" class="field-input" placeholder="0" :title="d.label">
      </label>
    </div>
    <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
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
.per-hour {
  margin-left: auto;
  color: var(--api);
  font-family: var(--f-title);
  font-size: 13px;
  font-weight: 400;
}
/* 메소·조각·주흔을 한 줄에 */
.amounts {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}
.drop input {
  text-align: right;
}
/* 메모와 버튼을 한 줄에 */
.bottom {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bottom .field-input {
  flex: 1;
}
</style>
