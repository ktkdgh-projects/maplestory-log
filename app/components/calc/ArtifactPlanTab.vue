<script setup lang="ts">
import type { BossBoardResponse } from '#shared/types'
import { ARTIFACT_BOOSTER_MAX_WEEKS, ARTIFACT_BOOSTER_WEEKS, ARTIFACT_CRYSTALS, ARTIFACT_NORMAL_MISSION_EXP } from '#shared/data/artifact'
import { findBoss } from '#shared/data/bosses'

type Weeks = { plain: number | null, boosted: number | null }
const props = defineProps<{
  ready: boolean
  today: string
  roster: BossBoardResponse['roster'] | null
  bossAuto: { exp: number, counted: string[] }
  boss: number
  goal: Weeks
  milestones: ((typeof ARTIFACT_CRYSTALS)[number] & Weeks)[]
  leftExp: number
}>()
const normal = defineModel<number>('normal', { required: true })
const boosters = defineModel<number>('boosters', { required: true })
const bossManual = defineModel<number | null>('bossManual', { required: true })

const ICONS = assetsByName(import.meta.glob<string>('~/assets/artifact/*.png', { eager: true, import: 'default' }))
const NORMAL_CHOICES = [ARTIFACT_NORMAL_MISSION_EXP, 1000, 0]
const MAX_BOOSTERS = ARTIFACT_BOOSTER_MAX_WEEKS / ARTIFACT_BOOSTER_WEEKS

const dateAfter = (weeks: number | null) => (weeks === null ? '-' : formatDay(addDays(props.today, weeks * 7)))
const at = (weeks: number | null) => `${props.goal.plain ? Math.min((weeks ?? 0) / props.goal.plain, 1) * 100 : 0}%`
</script>

<template>
  <div class="plan">
    <aside class="inputs">
      <section>
        <b class="t">한 주에 받는 EXP</b>
        <span class="label">일반 미션 <small class="muted">몬스터 2만 + 접속 4회 = 2,000</small></span>
        <div class="mini-seg wide">
          <button v-for="n in NORMAL_CHOICES" :key="n" type="button" :aria-pressed="normal === n" @click="normal = n">{{ n ? n.toLocaleString('ko-KR') : '안 함' }}</button>
        </div>
        <span class="label">보스 미션 <small class="muted">월드에서 가장 높은 3개</small></span>
        <div v-if="bossManual === null && bossAuto.counted.length" class="chips">
          <span v-for="id in bossAuto.counted" :key="id" class="chip">{{ findBoss(id)?.name ?? id }}</span>
        </div>
        <label class="num-in">
          <span class="muted">{{ bossManual !== null ? '직접 입력' : roster === null ? '보스 세팅 불러오는 중' : bossAuto.counted.length ? '보스 수입 세팅 기준' : '보스 수입 세팅이 없어요' }}</span>
          <input :value="boss || ''" type="number" inputmode="numeric" min="0" placeholder="0" @input="bossManual = Number(($event.target as HTMLInputElement).value) || 0">
        </label>
        <button v-if="bossManual !== null" type="button" class="link" @click="bossManual = null">보스 세팅 값으로 되돌리기</button>
        <div class="total"><span class="muted">합계</span><b>{{ (normal + boss).toLocaleString('ko-KR') }}</b><span class="muted">/ 주</span></div>
      </section>
      <section class="booster">
        <b class="t">아티팩트 부스터</b>
        <div class="stepper">
          <button type="button" aria-label="하나 빼기" :disabled="boosters <= 0" @click="boosters--">−</button>
          <b>{{ boosters }}<small>개</small></b>
          <button type="button" aria-label="하나 더하기" :disabled="boosters >= MAX_BOOSTERS" @click="boosters++">＋</button>
        </div>
        <small class="muted">일반 미션만 2배 · 개당 4주(소급) · 월드당 한 달 2개 · 9,900캐시 · 리부트 불가</small>
      </section>
    </aside>

    <section class="timeline">
      <div class="tl-head">
        <b>Lv 60까지 남은 EXP {{ leftExp.toLocaleString('ko-KR') }}</b>
        <span class="muted">주 {{ (normal + boss).toLocaleString('ko-KR') }} 기준</span>
      </div>
      <div v-for="track in [{ key: 'plain', label: '부스터 없이' }, { key: 'boosted', label: `부스터 ${boosters}개` }] as const" :key="track.key" class="track" :class="track.key">
        <span class="t-label">{{ track.label }}</span>
        <div class="line">
          <i class="tl-fill" :style="{ width: at(goal[track.key]) }" />
          <span v-for="m in milestones" :key="m.name" class="mark" :style="{ left: at(m[track.key]) }" :title="`${m.name} · ${dateAfter(m[track.key])}`"><img :src="ICONS[m.icon]" alt=""></span>
        </div>
        <span class="t-end"><b>{{ goal[track.key] === null ? '-' : `${goal[track.key]}주` }}</b><small>{{ dateAfter(goal[track.key]) }}</small></span>
      </div>
      <table v-if="milestones.length" class="miles">
        <thead><tr><th>크리스탈</th><th>레벨</th><th class="num">부스터 없이</th><th class="num">부스터 {{ boosters }}개</th><th class="num">당김</th></tr></thead>
        <tbody>
          <tr v-for="m in milestones" :key="m.name">
            <td><span class="mrow"><img :src="ICONS[m.icon]" alt="">{{ m.name }}</span></td>
            <td>Lv {{ m.unlock }}</td>
            <td class="num">{{ m.plain === null ? '-' : `${m.plain}주 · ${dateAfter(m.plain)}` }}</td>
            <td class="num gold">{{ m.boosted === null ? '-' : `${m.boosted}주 · ${dateAfter(m.boosted)}` }}</td>
            <td class="num">{{ m.plain !== null && m.boosted !== null && m.plain > m.boosted ? `${m.plain - m.boosted}주` : '-' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="ready" class="muted">크리스탈이 다 열렸어요.</p>
      <p class="muted small">보스 미션 EXP가 적을수록(키우는 중일수록) 부스터 효과가 커요. 일반 미션을 다 못 채우면 2배도 줄어요.</p>
    </section>
  </div>
</template>

<style scoped>
.muted {
  color: var(--sub);
}
.small {
  font-size: 12px;
}
.gold {
  color: var(--gold);
}
.link {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  text-decoration: underline dotted;
  cursor: pointer;
}
.link:hover {
  color: var(--api);
}
.plan {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}
.inputs > section,
.timeline {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  padding: 1px 9px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 12px;
}
.mini-seg {
  display: inline-flex;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 7px;
}
.mini-seg.wide {
  display: flex;
}
.mini-seg.wide button {
  flex: 1;
}
.mini-seg button {
  padding: 3px 10px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.mini-seg button:last-child {
  border-right: 0;
}
.mini-seg button[aria-pressed="true"] {
  background: var(--api);
  color: var(--bar);
  font-weight: 700;
}
.inputs {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
}
.t {
  font: 16px var(--f-title);
}
.label {
  font-size: 12.5px;
}
.num-in {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
}
.num-in input {
  width: 96px;
  min-height: 32px;
  padding: 0 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: right;
}
.total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--panel-line);
  font-size: 13px;
}
.total b {
  color: var(--api);
  font: 24px var(--f-title);
}
.booster {
  background: linear-gradient(135deg, color-mix(in srgb, var(--calc) 15%, transparent), transparent 70%), var(--panel) !important;
  border-color: var(--calc) !important;
}
.stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.stepper button {
  width: 36px;
  height: 36px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
}
.stepper button:disabled {
  opacity: 0.4;
  cursor: default;
}
.stepper b {
  min-width: 64px;
  color: var(--calc);
  font: 30px var(--f-title);
  text-align: center;
}
.stepper small {
  font-size: 14px;
}
.timeline {
  align-content: start;
  gap: 14px !important;
  min-height: 0;
  overflow-y: auto;
}
.tl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
}
.tl-head b {
  font: 17px var(--f-title);
}
.track {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 120px;
  align-items: center;
  gap: 14px;
}
.t-label {
  color: var(--sub);
  font-size: 13px;
}
.line {
  position: relative;
  height: 34px;
}
.line::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 6px;
  transform: translateY(-50%);
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.tl-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 6px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--tip-line);
  transition: width var(--normal) var(--ease-out);
}
.track.boosted .tl-fill {
  background: var(--calc);
}
.mark {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  transition: left var(--normal) var(--ease-out);
}
.mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.t-end {
  display: grid;
  text-align: right;
  line-height: 1.2;
}
.t-end b {
  font: 18px var(--f-title);
}
.track.boosted .t-end b {
  color: var(--calc);
}
.t-end small {
  color: var(--sub);
  font-size: 12px;
}
.miles {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.miles th,
.miles td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--panel-line);
  text-align: left;
}
.miles th {
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
}
.miles .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mrow img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
@media (max-width: 1100px) {
  .plan {
    grid-template-columns: minmax(0, 1fr);
  }
  .inputs,
  .timeline {
    overflow: visible;
  }
}
@media (max-width: 640px) {
  .track {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .t-end {
    text-align: left;
  }
}
</style>
