<script setup lang="ts">
const props = defineProps<{ character: string, item: string, kind: 'starforce' | 'potential', date: string, amount: number }>()

const state = ref<'idle' | 'busy' | 'done'>('idle')
const failure = ref('')
async function add() {
  state.value = 'busy'
  failure.value = ''
  try {
    await $fetch('/api/items/enhance-entry', { method: 'POST', body: { ...props, amount: Math.round(props.amount) } })
    state.value = 'done'
  }
  catch (error) {
    failure.value = errorMessage(error)
    state.value = 'idle'
  }
}
</script>

<template>
  <button v-if="state !== 'done'" type="button" class="add" :disabled="state === 'busy'" @click="add">장비 결산에 넣기 ({{ formatDay(date) }} · {{ formatShortNumber(amount) }})</button>
  <NuxtLink v-else to="/items" class="add done">장비 결산에 넣었어요 · 보러 가기 →</NuxtLink>
  <span v-if="failure" class="fail">{{ failure }}</span>
</template>

<style scoped>
.add {
  min-height: 36px;
  padding: 5px 12px;
  background: none;
  border: 1px solid rgb(242 193 78 / 0.55);
  border-radius: 8px;
  color: var(--gold);
  font: inherit;
  font-size: 12.5px;
  text-decoration: none;
  cursor: pointer;
}
.add:disabled {
  opacity: 0.6;
  cursor: default;
}
.add.done {
  border-color: rgb(127 217 154 / 0.55);
  color: var(--gain);
}
.fail {
  align-self: center;
  color: var(--loss);
  font-size: 12px;
}
</style>
