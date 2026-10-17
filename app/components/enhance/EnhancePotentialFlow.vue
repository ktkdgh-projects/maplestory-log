<script setup lang="ts">
import { POTENTIAL_GRADES, type PotentialGrade } from '#shared/data/potential'

type Step = { from: string, to: string, tries: number | null, working: number | null, ceiling: number | null, mixed: boolean }

const props = defineProps<{ steps: Step[], grade: string | null }>()

const reached = (g: string) => !!props.grade && POTENTIAL_GRADES.indexOf(g as PotentialGrade) <= POTENTIAL_GRADES.indexOf(props.grade as PotentialGrade)
const gradeStyle = (g: string | null) => ({ '--grade': potentialGradeColor(g) ?? 'var(--tip-line)' })
</script>

<template>
  <div class="flow">
    <template v-for="(s, i) in steps" :key="s.from">
      <span class="node" :class="{ dim: !reached(s.from) }" :style="gradeStyle(s.from)">{{ s.from }}</span>
      <div class="edge">
        <b v-if="s.tries !== null">{{ s.tries }}번</b>
        <b v-else-if="s.working !== null" class="working">{{ s.working }}번째</b>
        <b v-else class="none">이 기간 변화 없음</b>
        <div class="track"><i :style="{ width: `${s.ceiling && (s.tries ?? s.working) !== null ? Math.min(100, ((s.tries ?? s.working)! / s.ceiling) * 100) : 0}%` }" :class="{ working: s.working !== null }" /></div>
        <small>{{ s.ceiling ? `천장 ${s.ceiling}` : s.mixed ? '도구 섞음' : '' }}</small>
      </div>
      <span v-if="i === steps.length - 1" class="node" :class="{ dim: !reached(s.to) }" :style="gradeStyle(s.to)">{{ s.to }}</span>
    </template>
  </div>
</template>

<style scoped>
/* 막대는 공식 천장 대비 */
.flow {
  display: grid;
  flex: none;
  grid-template-columns: auto 1fr auto 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--tint) 2%, transparent);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.node {
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--grade) 55%, transparent);
  border-radius: 8px;
  color: var(--grade);
  font-family: var(--f-title);
  font-size: 16px;
  text-align: center;
  white-space: nowrap;
}
.node.dim {
  opacity: 0.35;
}
.edge {
  display: grid;
  gap: 4px;
  color: var(--sub);
  font-size: 12px;
  text-align: center;
}
.edge b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.edge b.working {
  color: var(--gold);
}
.edge b.none {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
}
.track {
  position: relative;
  height: 6px;
  overflow: hidden;
  background: var(--field);
  border-radius: 3px;
}
.track i {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--tip-line);
  border-radius: 3px;
}
.track i.working {
  background: var(--gold);
}
@media (max-width: 640px) {
  .flow {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 8px 12px;
  }
  .edge {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    text-align: left;
  }
}
</style>
