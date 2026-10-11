<script setup lang="ts">
defineProps<{ id: string, label: string }>()
const value = defineModel<number | null>({ required: true })

// 메소는 만 단위로 친다(1 → 1만 메소). 쉼표를 넣어 보여 주고 저장은 메소로
const text = computed({
  get: () => mesoToManText(value.value),
  set: (input: string) => {
    value.value = manTextToMeso(input)
  },
})
</script>

<template>
  <label :for="id" class="meso-input">
    <span class="label">{{ label }}</span>
    <span class="box">
      <input :id="id" v-model="text" class="field-input" inputmode="numeric" autocomplete="off" placeholder="0">
      <small class="unit">만</small>
    </span>
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
.box {
  position: relative;
  display: block;
}
input {
  padding-right: 30px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.unit {
  position: absolute;
  top: 50%;
  right: 12px;
  color: var(--sub);
  font-size: 13px;
  transform: translateY(-50%);
  pointer-events: none;
}
.hint {
  min-height: 1.4em;
  color: var(--gold);
  font-size: 12px;
  text-align: right;
}
</style>
