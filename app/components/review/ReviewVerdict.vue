<script setup lang="ts">
import type { SundayNotice } from '#shared/types'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

const props = defineProps<{
  state: 'charactersFailed' | 'noCharacter' | 'failure' | 'empty' | 'ready' | 'loading'
  failure: string
  rangeLabel: string
  nearestDay: string | null
  sundayInRange: SundayNotice | null
  totals: ReturnType<typeof useReviewCompute>['totals']['value']
  starforceCount: number
  potentialCount: number
  lost: boolean
  stuck: boolean
}>()
const emit = defineEmits<{ reloadCharacters: [], reload: [], pick: [date: string] }>()

const sundayEffectText = computed(() => (props.sundayInRange?.effects ?? []).map(e => SUNDAY_STARFORCE_EFFECTS.find(x => x.key === e)?.label ?? e).join(' · '))
const cubeText = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}개`
</script>

<template>
  <section class="verdict" :class="{ loss: lost && !stuck, plain: stuck }">
    <template v-if="state === 'charactersFailed'">
      <p class="say">캐릭터 목록을 불러오지 못했어요.</p>
      <div class="side">
        <button type="button" class="near" @click="emit('reloadCharacters')">다시 불러오기</button>
      </div>
    </template>
    <template v-else-if="state === 'noCharacter'">
      <p class="say">계정에서 캐릭터를 찾지 못했어요.<br><span class="s2">넥슨 API 키가 캐릭터가 있는 계정의 키인지 확인해 주세요.</span></p>
      <div class="side">
        <NuxtLink to="/me" class="near">내 정보로 가기 →</NuxtLink>
      </div>
    </template>
    <template v-else-if="state === 'failure'">
      <p class="say">결산을 불러오지 못했어요.<br><span class="s2">{{ failure }}</span></p>
      <div class="side">
        <button type="button" class="near" @click="emit('reload')">다시 불러오기</button>
      </div>
    </template>
    <template v-else-if="state === 'empty'">
      <p class="say">{{ rangeLabel }}은 강화 기록이 없어요.</p>
      <div class="side">
        <button v-if="nearestDay" type="button" class="near" @click="emit('pick', nearestDay)">가장 가까운 기록 · {{ formatDayWeek(nearestDay) }} →</button>
      </div>
    </template>
    <template v-else-if="state === 'ready'">
      <p class="say">
        <template v-if="totals.meso.expected">
          {{ rangeLabel }} 강화로 <em>{{ formatShortNumber(Math.abs(totals.meso.gain)) }} {{ totals.meso.gain >= 0 ? '이득' : '손해' }}</em> 봤어요.<br>
          <span class="s2">평균이면 <b>{{ formatShortNumber(totals.meso.expected) }}</b> 들 강화를 <b>{{ formatShortNumber(totals.meso.actual) }}</b>에 끝냈어요.<template v-if="totals.cube.used"> 큐브는 평균보다 <b>{{ cubeText(totals.cube.gain) }}</b> {{ totals.cube.gain >= 0 ? '덜' : '더' }} 썼어요.</template></span>
        </template>
        <template v-else-if="totals.cube.used">
          {{ rangeLabel }} 큐브를 평균보다 <em>{{ cubeText(totals.cube.gain) }} {{ totals.cube.gain >= 0 ? '덜' : '더' }}</em> 썼어요.
        </template>
        <template v-else>
          {{ rangeLabel }} 강화 기록이에요.<br><span class="s2">비교할 수 있는 결과가 없어 쓴 만큼만 보여 드려요.</span>
        </template>
      </p>
      <div class="side">
        <span v-if="sundayInRange" class="sunday"><i aria-hidden="true" />{{ formatDay(kstDateOf(sundayInRange.start)) }} 썬데이{{ sundayEffectText ? ` · ${sundayEffectText}` : '' }}</span>
        <div class="splits">
          <span v-if="starforceCount">스타포스 {{ starforceCount }}부위<b :class="totals.sf.gain >= 0 ? 'gain' : 'loss'">{{ totals.sf.count ? formatSigned(totals.sf.gain, formatShortNumber) : '-' }}</b></span>
          <span v-if="potentialCount">잠재 {{ potentialCount }}부위<b :class="(totals.pot.expected ? totals.pot.gain : totals.cube.gain) >= 0 ? 'gain' : 'loss'">{{ totals.pot.expected ? formatSigned(totals.pot.gain, formatShortNumber) : totals.cube.used ? `${totals.cube.gain >= 0 ? '+' : '−'}${cubeText(totals.cube.gain)}` : '-' }}</b></span>
        </div>
      </div>
    </template>
    <template v-else>
      <span class="skeleton say-skeleton" />
      <span class="skeleton side-skeleton" />
    </template>
  </section>
</template>

<style scoped>
/* 종합 한 문장. 높이를 잡아 둬서 계산이 끝나도 아래가 밀리지 않는다 */
.verdict {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 24px;
  min-height: 112px;
  padding: 16px 20px;
  /* 이득·손해는 왼쪽 띠와 글자색으로만 알리고 바탕은 칠하지 않는다 */
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 4px solid var(--gain);
  border-radius: 12px;
}
.verdict.loss {
  border-left-color: var(--loss);
}
.say {
  margin: 0;
  font-family: var(--f-title);
  font-size: 23px;
  line-height: 1.45;
}
.say em {
  color: var(--gain);
  font-size: 32px;
  font-style: normal;
}
.verdict.loss .say em {
  color: var(--loss);
}
.s2 {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 14px;
}
.s2 b {
  color: var(--text);
}
.side {
  display: grid;
  justify-items: end;
  gap: 8px;
}
.sunday {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--gain) 50%, transparent);
  border-radius: 999px;
  color: var(--gain);
  font-size: 12px;
  white-space: nowrap;
}
.sunday i {
  width: 7px;
  height: 7px;
  background: var(--gain);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--gain);
}
.splits {
  display: flex;
  gap: 8px;
}
.splits span {
  display: grid;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--tint) 3%, transparent);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 11.5px;
  text-align: right;
}
.splits b {
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.near {
  padding: 6px 12px;
  background: none;
  border: 1px solid color-mix(in srgb, var(--gain) 55%, transparent);
  border-radius: 8px;
  color: var(--gain);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.say-skeleton {
  height: 60px;
}
.side-skeleton {
  width: 220px;
  height: 52px;
}
.verdict.plain {
  background: var(--panel);
  border-color: var(--panel-line);
}
a.near {
  text-decoration: none;
}
@media (max-width: 760px) {
  .verdict {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    justify-items: start;
  }
}
@media (max-width: 640px) {
  .say {
    font-size: 19px;
  }
  .say em {
    font-size: 26px;
  }
}
</style>
