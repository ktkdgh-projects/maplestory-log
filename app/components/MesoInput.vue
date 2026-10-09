<script setup lang="ts">
defineProps<{ id: string, label: string, required?: boolean }>()
const value = defineModel<number | null>({ required: true })

// 큰 숫자를 읽기 쉽게 쉼표를 넣어 보여주고, 저장은 숫자만 남긴다
const text = computed({
  get: () => (value.value === null ? '' : value.value.toLocaleString('ko-KR')),
  set: (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 16)
    value.value = digits ? Number(digits) : null
  },
})
</script>

<template>
  <label :for="id" class="meso-input">
    <span class="label">{{ label }}</span>
    <input :id="id" v-model="text" class="field-input" inputmode="numeric" autocomplete="off" :required="required" placeholder="0">
    <small class="hint">{{ value ? `${formatKoreanNumber(value)} 메소` : ' ' }}</small>
  </label>
</template>

<style scoped>
.meso-input {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.label {
  color: var(--sub);
  font-size: 13px;
}
input {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.hint {
  min-height: 1.4em;
  color: var(--gold);
  font-size: 12px;
  text-align: right;
}
</style>
