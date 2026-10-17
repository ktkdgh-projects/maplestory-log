<script setup lang="ts">
defineProps<{
  on: boolean
  usePass: boolean
  today: string
}>()
const pass = defineModel<boolean>('pass', { required: true })
const passUntil = defineModel<string>('until', { required: true })
</script>

<template>
  <section class="calc-section pass-section" :class="{ off: !on }" :inert="!on">
    <h3 class="calc-section-title">제네시스 패스<small>{{ on ? '흔적 3배' : '제네시스 해방에만 있어요' }}</small></h3>
    <div class="calc-seg wide" role="group" aria-label="제네시스 패스">
      <button type="button" :aria-pressed="!usePass" @click="pass = false">없음</button>
      <button type="button" :aria-pressed="usePass" @click="pass = true">있음</button>
    </div>
    <!-- 패스가 없어도 자리를 잡아 둬서 눌러도 아래 칸이 밀리지 않게 한다 -->
    <div class="calc-field pass-until" :class="{ off: !usePass }" :inert="!usePass">
      <span class="calc-label">효과 끝나는 날 · 비워 두면 끝까지 3배</span>
      <div class="date-box">
        <DatePicker v-model="passUntil" :min="today" placeholder="끝까지 적용" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.pass-until,
.pass-section {
  transition: opacity var(--fast) ease;
}
.pass-until.off,
.pass-section.off {
  opacity: 0.35;
}
.pass-section.off .pass-until.off {
  opacity: 1;
}
.date-box {
  display: flex;
  align-items: stretch;
  min-height: 36px;
  background: var(--field);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
</style>
