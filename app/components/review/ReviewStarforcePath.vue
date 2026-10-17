<script setup lang="ts">
import type { ReviewStarforce, StarforceRestore } from '#shared/types'

type Stage = ReviewStarforce['stages'][number] & { mean: number, luck: string }

const props = defineProps<{ s: ReviewStarforce, stages: Stage[] }>()
const showAll = defineModel<boolean>('showAll', { required: true })

// 터지거나 멈추기 전까지 연달아 올린 걸 한 구간으로 묶는다
type Segment = { from: number, to: number, tries: number, end: 'destroy' | 'stop' | 'goal', restore: StarforceRestore | null }
const segments = computed(() => {
  const list: Segment[] = []
  let cur: Segment | null = null
  for (const step of props.s.path) {
    cur ??= { from: step.star, to: step.star, tries: 0, end: 'goal', restore: null }
    cur.tries += step.tries
    if (step.result === 'up') {
      cur.to = step.star + 1
      continue
    }
    cur.to = step.star
    cur.end = step.result
    cur.restore = step.restore
    list.push(cur)
    cur = null
  }
  if (cur) list.push(cur)
  return list
})
// 구간이 많으면 앞 둘·뒤 둘만 보이고 가운데는 "파괴 n번 더"로 접는다(null 자리)
const SEGMENTS_FOLDED = 6
const shownSegments = computed<(Segment | null)[]>(() => {
  const list = segments.value
  if (showAll.value || list.length <= SEGMENTS_FOLDED) return list
  return [...list.slice(0, 2), null, ...list.slice(-2)]
})
const hiddenDestroys = computed(() => segments.value.slice(2, -2).filter(seg => seg.end === 'destroy').length)
const restoreText = (r: StarforceRestore | null) => (!r ? '복구 방법 모름' : r.to === 12 ? '12성 복구' : `★${r.to} 흔적 복구${r.fee ? ` ${formatShortNumber(r.fee)}` : ''}`)
const restoreSummary = computed(() => {
  const list = props.s.path.filter(p => p.result === 'destroy')
  const twelve = list.filter(p => p.restore?.to === 12).length
  const trace = list.filter(p => p.restore && p.restore.to !== 12).length
  return [`파괴 ${list.length}번`, twelve ? `12성 복구 ${twelve}` : '', trace ? `흔적 복구 ${trace}` : '', props.s.copies ? `노작 ${props.s.copies}개` : ''].filter(Boolean).join(' · ')
})
</script>

<template>
  <div class="how">
    <span class="caption">어떻게 올렸나<template v-if="s.destroys"> · {{ restoreSummary }}</template></span>
    <ol class="path">
      <template v-for="(seg, i) in shownSegments" :key="i">
        <li v-if="seg === null" class="more">
          <button type="button" @click="showAll = true">… 파괴 {{ hiddenDestroys }}번 더 · 전부 보기</button>
        </li>
        <li v-else class="seg" :class="seg.end">
          <span class="climb"><span class="star">★</span>{{ seg.from }} → <span class="star">★</span>{{ seg.to }}</span>
          <span class="tries">{{ seg.tries }}번</span>
          <span v-if="seg.end === 'destroy'" class="boom">★{{ seg.to }}에서 파괴 → {{ restoreText(seg.restore) }}</span>
          <span v-else-if="seg.end === 'stop'" class="edge">★{{ seg.to }}에서 멈춤</span>
          <span v-else class="edge goal">목표 도착</span>
        </li>
      </template>
    </ol>
    <button v-if="showAll && segments.length > SEGMENTS_FOLDED" type="button" class="fold" @click="showAll = false">접기</button>
    <table class="mini">
      <thead><tr><th>구간</th><th>누름</th><th>평균</th><th>운</th></tr></thead>
      <tbody>
        <tr v-for="st in stages" :key="st.star">
          <td>★{{ st.star }} → {{ st.star + 1 }}</td>
          <td>{{ st.attempts }}</td>
          <td>{{ st.mean.toFixed(1) }}</td>
          <td :class="st.luck === 'good' ? 'gain' : st.luck === 'bad' ? 'loss' : 'muted'">{{ st.luck === 'good' ? '좋음' : st.luck === 'bad' ? '나쁨' : '보통' }}<template v-if="st.destroy"> · 파괴 {{ st.destroy }}</template></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.star {
  color: var(--gold);
}
.caption {
  color: var(--sub);
  font-size: 12px;
}
.how {
  display: grid;
  gap: 8px;
}
.path {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}
.seg {
  display: grid;
  grid-template-columns: 110px 48px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--tint) 3%, transparent);
  border-left: 3px solid var(--panel-line);
  border-radius: 4px;
}
.seg.destroy {
  border-left-color: var(--loss);
}
.seg.goal {
  border-left-color: var(--gold);
}
.climb {
  font-family: var(--f-title);
  font-size: 14px;
}
.tries {
  color: var(--sub);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.edge {
  color: var(--sub);
  font-size: 11.5px;
}
.edge.goal {
  color: var(--gold);
}
.boom {
  color: var(--loss);
  font-size: 12px;
}
.more button,
.fold {
  justify-self: start;
  padding: 2px 10px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.more button:hover,
.fold:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.mini {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.mini th {
  padding: 4px 8px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 11.5px;
  font-weight: 400;
  text-align: right;
}
.mini td {
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--panel-line) 50%, transparent);
  text-align: right;
}
.mini th:first-child,
.mini td:first-child {
  text-align: left;
}
</style>
