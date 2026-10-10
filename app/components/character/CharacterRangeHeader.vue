<script setup lang="ts">
interface Total { label: string, value: string, tone: string }
// 지금 레벨까지 쓴 양. progress는 만렙까지 쓸 양 중 이미 쓴 비율(0~1)
interface Spent extends Total { unit: string, sub: string, progress: number }
defineProps<{ totals: Total[], spent?: Spent[], hint: string }>()
defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="header">
    <section v-if="spent?.length" class="spent">
      <header class="spent-head">
        <h3>지금 레벨까지 쓴 것</h3>
        <span class="muted">막대는 만렙까지 쓸 양 중 이만큼 썼다는 뜻이에요</span>
      </header>
      <div class="spent-items">
        <div v-for="s in spent" :key="s.label" class="spent-item" :style="{ '--tone': s.tone }">
          <div class="sp-top">
            <span class="sp-label"><i />{{ s.label }}</span>
            <span class="sp-pct">{{ s.progress >= 1 ? '만렙' : `${Math.floor(s.progress * 100)}%` }}</span>
          </div>
          <b class="sp-value">{{ s.value }}<small>{{ s.unit }}</small></b>
          <span class="sp-bar"><i :style="{ width: `${Math.min(100, s.progress * 100)}%` }" /></span>
          <small class="sp-sub">{{ s.sub }}</small>
        </div>
      </div>
    </section>
    <div class="totals">
      <div v-for="total in totals" :key="total.label" class="tile" :style="{ '--tone': total.tone }">
        <span class="tile-label">{{ total.label }}</span>
        <span class="tile-value">{{ total.value }}</span>
      </div>
    </div>
    <div class="toolbar">
      <span class="muted">{{ hint }} · 줄무늬는 이미 올린 레벨</span>
      <button type="button" class="reset" @click="$emit('reset')">지금 레벨 → 만렙으로</button>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: grid;
  gap: 10px;
}
.totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.spent {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  background:
    radial-gradient(420px 120px at 0 0, rgb(183 156 255 / 0.1), transparent 70%),
    var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.spent-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
}
.spent-head h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.spent-head .muted {
  font-size: 11.5px;
}
.spent-items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.spent-item {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.sp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
}
.sp-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sub);
}
.sp-label i {
  width: 8px;
  height: 8px;
  background: var(--tone);
  border-radius: 2px;
  transform: rotate(45deg);
}
.sp-pct {
  color: var(--tone);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sp-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text);
  font-family: var(--f-title);
  font-size: 22px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sp-value small {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
}
.sp-bar {
  display: block;
  height: 6px;
  overflow: hidden;
  background: var(--bar);
  border-radius: 3px;
}
.sp-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 55%, transparent), var(--tone));
  border-radius: 3px;
  transition: width var(--normal) var(--ease-out);
}
.sp-sub {
  overflow: hidden;
  color: var(--sub);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .spent-items {
    grid-template-columns: 1fr;
  }
}
.tile-value {
  font-size: 18px;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.reset {
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.reset:hover {
  border-color: var(--calc);
}
</style>
