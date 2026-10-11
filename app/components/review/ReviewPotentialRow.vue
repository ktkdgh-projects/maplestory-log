<script setup lang="ts">
import type { ReviewPotential } from '#shared/types'
import { mainTool, type PotentialReview } from '#shared/calc/review'

const props = defineProps<{ p: ReviewPotential, review: PotentialReview | null, loading: boolean, open: boolean, character: string, ocid: string, addDate: string | null, showOwner?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const tool = computed(() => mainTool(props.p))
const cube = computed(() => props.review?.verdict.unit === 'cube' || (!props.review && tool.value !== '메소 재설정'))
const verdict = computed(() => (props.review?.verdict.expected ? props.review.verdict : null))
const gain = computed(() => (verdict.value ? verdict.value.expected - verdict.value.actual : null))
const amount = (n: number) => (cube.value ? `${Math.round(n).toLocaleString('ko-KR')}개` : formatShortNumber(n))
const signed = (n: number) => (cube.value ? `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}개` : formatSigned(n, formatShortNumber))
const gradeStyle = (g: string | null) => ({ color: potentialGradeColor(g) ?? 'var(--text)' })
const tries = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}번`

const spent = computed(() => (cube.value ? props.p.tools.reduce((n, t) => n + t.count, 0) : props.p.manual ?? props.p.meso))
// 옵션 줄 색: 계산이 있으면 줄마다 등급, 없으면 장비 등급 하나로
const optionLines = computed(() => props.review?.lines ?? props.p.options.map(text => ({ text, grade: props.p.toGrade })))
const multiDay = computed(() => kstDateOf(props.p.first) !== kstDateOf(props.p.last))
const timeOf = (iso: string) => (multiDay.value ? `${formatDay(kstDateOf(iso))} ${kstTime(iso)}` : kstTime(iso))

const reason = computed(() => {
  const r = props.review
  if (!r || gain.value === null) return ''
  const parts: string[] = []
  for (const t of r.tiers) parts.push(`${t.from} → ${t.to}는 평균 ${tries(t.mean)}인데 ${tries(t.tries)}${t.tries <= t.mean ? '에 올렸어요' : ' 걸렸어요'}${t.tries >= t.ceiling ? '(천장)' : ''}.`)
  if (r.option) parts.push(`${r.option.label}은 평균 ${tries(r.option.mean)}에 한 번 뜨는데 ${tries(r.option.tries)}째에 떴어요.`)
  return parts.join(' ')
})
</script>

<template>
  <div class="row" :class="{ open }">
    <button type="button" class="head" :aria-expanded="open" @click="emit('toggle')">
      <span class="caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <img v-if="p.icon" :src="p.icon" alt="" class="icon">
      <span v-else class="icon" />
      <span class="nm">
        <b>{{ p.item }}</b>
        <small><span v-if="showOwner" class="owner">{{ character }}</span>{{ p.slot ?? '지금 안 낀 장비' }} · {{ p.additional ? '에디' : '윗잠' }} {{ p.tools.map(t => `${t.name} ${t.count}`).join(' · ') }} · <span :style="gradeStyle(p.fromGrade)">{{ p.fromGrade ?? '-' }}</span> → <span :style="gradeStyle(p.toGrade)">{{ p.toGrade ?? '-' }}</span></small>
      </span>
      <span class="cell">{{ cube ? '쓴 큐브' : '쓴 메소' }}<span v-if="p.manual !== null && !cube" class="src">수기</span><b>{{ amount(spent) }}</b></span>
      <span class="cell avg">평균이면<b>{{ verdict ? amount(verdict.expected) : loading ? '…' : '-' }}</b></span>
      <span class="luck">
        <template v-if="verdict && verdict.rank !== null">
          <span class="bar"><i :style="{ left: `${verdict.rank * 100}%` }" /></span>확률로 보면 상위 {{ Math.max(1, Math.round(verdict.rank * 100)) }}%
        </template>
        <template v-else-if="!loading">{{ review?.mixed ? '도구를 섞어 비교 안 함' : review ? '비교할 결과 없음' : '확률 확인 전' }}</template>
      </span>
      <span class="cell">{{ gain === null ? '' : gain >= 0 ? (cube ? '아낌' : '이득') : (cube ? '더 씀' : '손해') }}<b :class="gain === null ? '' : gain >= 0 ? 'gain' : 'loss'">{{ gain === null ? '-' : signed(gain) }}</b></span>
    </button>

    <div v-if="open" class="body">
      <div class="nums">
        <div>{{ cube ? '쓴 큐브' : '쓴 메소' }}<span v-if="p.manual !== null && !cube" class="src">수기</span><b>{{ amount(spent) }}</b><small>{{ p.tools.map(t => `${t.name} ${t.count}번`).join(' · ') }}</small></div>
        <div>평균이면<b>{{ verdict ? amount(verdict.expected) : '-' }}</b><small>{{ verdict ? '얻은 등급·옵션까지 평균' : review?.mixed ? '도구를 섞어 써서 비교하지 않아요' : review ? '비교할 결과가 없어요' : '이 도구는 확률 확인 전' }}</small></div>
        <div>결과<b><span :style="gradeStyle(p.fromGrade)">{{ p.fromGrade ?? '-' }}</span><template v-if="p.toGrade !== p.fromGrade"> → <span :style="gradeStyle(p.toGrade)">{{ p.toGrade }}</span></template></b><small>{{ review?.option ? review.option.label : p.options.length ? '옵션 목표 없음' : '-' }}</small></div>
      </div>

      <div class="two">
        <div v-if="review" class="bars">
          <span class="caption">평균과 비교 · 막대가 실제, 세로선이 평균</span>
          <div v-for="t in review.tiers" :key="t.from" class="bar-row">
            <span><span :style="gradeStyle(t.from)">{{ t.from }}</span> → <span :style="gradeStyle(t.to)">{{ t.to }}</span></span>
            <span class="track">
              <i :class="t.tries <= t.mean ? 'good' : 'bad'" :style="{ width: `${Math.min(100, (t.tries / t.ceiling) * 100)}%` }" />
              <u :style="{ left: `${Math.min(100, (t.mean / t.ceiling) * 100)}%` }" />
            </span>
            <span class="num">{{ tries(t.tries) }} · <span :class="t.tries <= t.mean ? 'gain' : 'loss'">평균 {{ tries(t.mean) }}</span> · 천장 {{ t.ceiling }}</span>
          </div>
          <div v-if="review.option" class="bar-row">
            <span>옵션 <span class="opt">{{ review.option.label }}</span></span>
            <span class="track">
              <i :class="review.option.tries <= review.option.mean ? 'good' : 'bad'" :style="{ width: `${Math.min(100, (review.option.tries / (review.option.mean * 2)) * 100)}%` }" />
              <u style="left: 50%" />
            </span>
            <span class="num">{{ tries(review.option.tries) }} · <span :class="review.option.tries <= review.option.mean ? 'gain' : 'loss'">평균 {{ tries(review.option.mean) }}</span></span>
          </div>
          <p v-if="review.mixed" class="muted small">{{ p.tools.map(t => t.name).join(' · ') }}, 여러 도구를 섞어 썼어요. 도구마다 등급 확률·천장이 달라 한 도구 기준 평균과 견주지 않아요.</p>
          <p v-else-if="!review.tiers.length && !review.option" class="muted small">이 기간엔 등급이 오르지 않았고, 지금 옵션으로 이룬 목표도 표에 없어 비교할 결과가 없어요.</p>
        </div>
        <div v-else-if="loading" class="skeleton bars-skeleton" />
        <div v-else class="bars">
          <span class="caption">평균과 비교</span>
          <p class="muted small">{{ tool }}는 공식 등급·옵션 확률을 아직 넣지 않았거나 장비 부위·레벨을 몰라서, 돌린 횟수와 일어난 순간만 보여 드려요.</p>
        </div>

        <div class="moments">
          <span class="caption">{{ multiDay ? '기간에 일어난 순간' : '그날 일어난 순간' }}</span>
          <ol>
            <li class="m-start">
              <time>{{ timeOf(p.first) }}</time>
              <span class="what">시작</span>
              <span><span :style="gradeStyle(p.fromGrade)">{{ p.fromGrade ?? '-' }}</span><template v-if="p.stackBefore"> · 그 등급에서 이미 {{ p.stackBefore }}번 돌림({{ tool }})</template></span>
            </li>
            <li v-for="t in p.tiers" :key="t.at" class="m-up">
              <time>{{ timeOf(t.at) }}</time>
              <span class="what" :style="gradeStyle(t.to)">등급 상승</span>
              <span>{{ t.tries }}번째에 <span :style="gradeStyle(t.to)">{{ t.to }}</span></span>
            </li>
            <li v-if="p.optionTime" class="m-opt">
              <time>{{ timeOf(p.optionTime) }}</time>
              <span class="what">옵션 확정</span>
              <span class="opt-lines">
                <small>{{ p.tiers.length ? `${p.toGrade ? gradeSubject(p.toGrade) : ''} 된 뒤` : '이 기간' }} {{ p.optionAt }}번째</small>
                <span v-for="(l, i) in optionLines" :key="i" :style="gradeStyle(l.grade)">{{ l.text }}</span>
              </span>
            </li>
            <li v-if="p.optionAt && p.optionTries > p.optionAt" class="m-end">
              <time>{{ timeOf(p.last) }}</time>
              <span class="what">끝</span>
              <span>옵션이 뜬 뒤 {{ p.optionTries - p.optionAt }}번 더 돌리고 위 옵션을 남김</span>
            </li>
          </ol>
        </div>
      </div>

      <div v-if="review" class="why">
        <span v-if="reason"><b>{{ gain === null ? '결과.' : gain >= 0 ? '왜 이득이었나.' : '왜 손해였나.' }}</b> {{ reason }}<template v-if="verdict && verdict.actual > verdict.expected && p.optionAt && p.optionTries > p.optionAt"> 옵션이 뜬 뒤 더 돌린 것도 쓴 쪽에 들어 있어요.</template></span>
        <span><b>계산 조건.</b> {{ review.method.label }} 공식 등급 상승 확률·천장<template v-if="p.stackBefore"> (기간 전에 쌓인 천장 {{ p.stackBefore }}번 반영)</template> · 옵션은 지금 옵션과 같은 효과 합 이상이 뜰 확률(공식 옵션 확률표){{ review.method.meso ? ' · 공식 비용표' : '' }}</span>
      </div>
      <div class="actions">
        <NuxtLink :to="{ path: '/calc/potential', query: { part: p.additional ? 'additional' : undefined, slot: p.slot ?? undefined, level: p.level ?? undefined, grade: p.fromGrade ?? undefined } }" class="act calc">잠재 계산기로 보기 →</NuxtLink>
        <NuxtLink :to="{ path: '/potential', query: { ocid, item: p.item, part: p.additional ? 'additional' : undefined } }" class="act">이 장비 기록 전체 보기 →</NuxtLink>
        <ReviewAddToItems v-if="addDate && p.manual === null && p.meso" :character="character" :item="p.item" kind="potential" :date="addDate" :amount="p.meso" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.row {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.row.open {
  border-color: var(--tip-line);
}
.head {
  display: grid;
  grid-template-columns: 14px 34px minmax(0, 1fr) 96px 96px 150px 96px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.caret {
  color: var(--sub);
  font-size: 12px;
}
.open .caret {
  color: var(--gold);
}
.icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
  image-rendering: pixelated;
}
.nm {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}
.nm b {
  overflow: hidden;
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm small {
  overflow: hidden;
  color: var(--sub);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.owner {
  margin-right: 6px;
  padding: 0 6px;
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border-radius: 4px;
  color: var(--gold);
}
.cell {
  display: grid;
  color: var(--sub);
  font-size: 11px;
  line-height: 1.3;
  text-align: right;
}
.cell b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.cell b.gain {
  color: var(--gain);
}
.cell b.loss {
  color: var(--loss);
}
.src {
  margin-left: 4px;
  padding: 0 4px;
  background: rgb(242 193 78 / 0.18);
  border-radius: 4px;
  color: var(--gold);
  font-size: 10px;
  font-weight: 800;
}
.luck {
  display: grid;
  gap: 3px;
  color: var(--sub);
  font-size: 11px;
  text-align: right;
}
.luck .bar {
  position: relative;
  height: 6px;
  background: linear-gradient(90deg, rgb(127 217 154 / 0.7), rgb(165 174 203 / 0.25) 50%, rgb(255 138 122 / 0.7));
  border-radius: 3px;
}
.luck .bar i {
  position: absolute;
  top: -3px;
  width: 3px;
  height: 12px;
  background: var(--text);
  border-radius: 2px;
  translate: -50% 0;
}
.body {
  display: grid;
  gap: 14px;
  padding: 14px 16px 16px 58px;
  border-top: 1px dashed var(--panel-line);
}
.nums {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.nums div {
  display: grid;
  gap: 1px;
  padding: 9px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font-size: 12px;
}
.nums b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.nums small {
  overflow: hidden;
  color: var(--sub);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.two {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.caption {
  color: var(--sub);
  font-size: 12px;
}
.bars {
  display: grid;
  gap: 10px;
  align-content: start;
}
.bars-skeleton {
  height: 90px;
}
.moments {
  display: grid;
  gap: 6px;
}
.moments ol {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.moments li {
  display: grid;
  grid-template-columns: 62px 64px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  padding: 5px 10px;
  background: rgb(255 255 255 / 0.03);
  border-left: 3px solid var(--panel-line);
  border-radius: 4px;
  font-size: 12.5px;
}
.moments time {
  color: var(--sub);
  font-variant-numeric: tabular-nums;
}
.what {
  color: var(--sub);
  font-weight: 700;
}
.m-up {
  border-left-color: var(--gain) !important;
}
.m-opt {
  border-left-color: var(--gold) !important;
}
.m-opt .what {
  color: var(--gold);
}
.opt-lines {
  display: grid;
  gap: 1px;
}
.opt-lines small {
  color: var(--sub);
  font-size: 11.5px;
}
/* 등급 막대는 오른쪽 끝이 천장, 옵션 막대는 가운데가 평균 */
.bar-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
}
.opt {
  margin-left: 4px;
  color: var(--text);
}
.track {
  position: relative;
  height: 8px;
  background: #11152a;
  border-radius: 4px;
}
.track i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
}
.track i.good {
  background: var(--gain);
}
.track i.bad {
  background: var(--loss);
}
.track u {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: var(--tip-line);
  text-decoration: none;
}
.num {
  grid-column: 1 / -1;
  color: var(--sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.small {
  margin: 0;
  font-size: 12.5px;
}
.why {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px dashed var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font-size: 13px;
}
.why b {
  color: var(--text);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.act {
  padding: 5px 12px;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
  text-decoration: none;
}
.act:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.act.calc {
  border-color: rgb(183 156 255 / 0.55);
  color: var(--calc);
}
@media (max-width: 760px) {
  .head {
    grid-template-columns: 14px 34px minmax(0, 1fr) 80px 80px;
  }
  .head .avg,
  .head .luck {
    display: none;
  }
  .body {
    padding-left: 16px;
  }
  .bar-row,
  .nums,
  .two {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .head {
    grid-template-columns: 14px 34px minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px 10px;
    padding: 10px 12px;
  }
  .nm {
    grid-column: 3 / -1;
  }
  .head > .cell:nth-child(4) {
    grid-row: 2;
    grid-column: 3;
    text-align: left;
  }
  .head > .cell:last-child {
    grid-row: 2;
    grid-column: 4;
  }
  .body {
    padding-left: 12px;
  }
}
</style>
