<script setup lang="ts">
import { MEISTER_POTION_DAILY_LIMIT, MEISTER_STAGES, type MeisterMaterialKey } from '#shared/data/meister'
import { MEISTER_START, dailyFatigue, normalizeMeister, planMeisterDays, remainingCrafts, stageTotal, type MeisterProgress } from '#shared/calc/meister'

useHead({ title: '명장 · 메이플스토리로그' })

const ICONS = assetsByName(import.meta.glob<string>('~/assets/meister/*.png', { eager: true, import: 'default' }))
const STORE_KEY = 'meister'
const SAVE_DELAY_MS = 600
const TONES = ['var(--exp)', 'var(--api)', 'var(--purple)']

const { me } = await useMe()
const progress = ref<MeisterProgress>({ ...MEISTER_START })
const ready = ref(false)

onMounted(async () => {
  let saved: Partial<MeisterProgress> | null = null
  if (me.value) saved = await $fetch<MeisterProgress>('/api/guides/meister').catch(() => null)
  else {
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    }
    catch {}
  }
  progress.value = normalizeMeister(saved)
  ready.value = true
})

let timer: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (me.value) $fetch('/api/guides/meister', { method: 'PUT', body: progress.value }).catch(() => {})
    else {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(progress.value))
      }
      catch {}
    }
  }, SAVE_DELAY_MS)
}
watch(progress, () => ready.value && save(), { deep: true })
onBeforeUnmount(() => clearTimeout(timer))

const done = computed(() => progress.value.stage >= MEISTER_STAGES.length)
const days = computed(() => planMeisterDays(progress.value))
const leftCrafts = computed(() => remainingCrafts(progress.value).reduce((n, c) => n + c.left, 0))
const leftFatigue = computed(() => days.value.reduce((n, d) => n + d.fatigue, 0))
const cap = computed(() => dailyFatigue(progress.value))

function pickStage(s: number) {
  progress.value = { ...progress.value, stage: s, made: 0 }
}
function setMade(value: number) {
  const max = MEISTER_STAGES[progress.value.stage] ? stageTotal(MEISTER_STAGES[progress.value.stage]!) : 0
  progress.value = { ...progress.value, made: Math.min(Math.max(Math.trunc(value) || 0, 0), max) }
}
function addPotion(step: number) {
  const potions = Math.min(Math.max(progress.value.potions + step, 0), MEISTER_POTION_DAILY_LIMIT)
  progress.value = { ...progress.value, potions }
}
function toggleHave(key: MeisterMaterialKey) {
  const have = progress.value.have.includes(key) ? progress.value.have.filter(k => k !== key) : [...progress.value.have, key]
  progress.value = { ...progress.value, have }
}
</script>

<template>
  <GameWindow class="fit" title="명장" sub="마이스터빌 장비제작 · Lv 100" fill>
    <div class="meister">
      <section class="hero">
        <img :src="ICONS['npc-eisen']" alt="" class="npc">
        <div class="big">
          <span v-if="!ready" class="skeleton hero-skeleton" />
          <template v-else-if="done">
            <span class="muted">장비제작</span>
            <b class="d">명장 달성</b>
          </template>
          <template v-else>
            <span class="muted">명장까지</span>
            <b class="d">{{ days.length }}일 <small>· 하루 피로도 {{ cap.toLocaleString('ko-KR') }} 기준</small></b>
          </template>
        </div>
        <div class="tips">
          <span class="reward">다 찍으면 크리티컬 데미지 +5% 버프</span>
          <p title="손재주로 숙련도가 두 배로 들어오면 적힌 개수보다 빨리 올라요">개수는 손재주 없이 센 최대치 · <b>목표 레벨에 닿으면</b> 다음 아이템으로</p>
        </div>
        <dl class="facts">
          <div><dt>하루 피로도</dt><dd>{{ cap }}</dd></div>
          <div><dt>남은 제작</dt><dd>{{ ready ? `${leftCrafts}회` : '-' }}</dd></div>
          <div><dt>남은 피로도</dt><dd>{{ ready ? leftFatigue.toLocaleString('ko-KR') : '-' }}</dd></div>
        </dl>
      </section>

      <div class="main">
        <MeisterStageList :progress="progress" :ready="ready" :icons="ICONS" :tones="TONES" />

        <div class="side">
          <MeisterProgressPanel
            :progress="progress"
            :ready="ready"
            :done="done"
            :days="days"
            :cap="cap"
            :signed-in="!!me"
            :icons="ICONS"
            :tones="TONES"
            @pick-stage="pickStage"
            @set-made="setMade"
            @add-potion="addPotion"
          />

          <MeisterShopPanel :progress="progress" :ready="ready" :icons="ICONS" @toggle="toggleHave" />
        </div>
      </div>

      <p class="foot muted">출처: 인벤 웹진 명장 공략 · 나무위키 전문기술 · 공식 업데이트 722(하루 피로도). 회당 피로도는 블로그 수치라 추정이에요.</p>
    </div>
  </GameWindow>
</template>

<style scoped>
.meister {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  height: 100%;
}
.muted {
  color: var(--sub);
}
img {
  image-rendering: pixelated;
  object-fit: contain;
}

.hero {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 8px 18px;
  background: radial-gradient(420px 140px at 0 50%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%), var(--panel);
  border: 1px solid var(--gold);
  border-radius: 12px;
}
.npc {
  width: 44px;
}
.big {
  display: grid;
  gap: 2px;
}
.big .muted {
  font-size: 12.5px;
}
.d {
  color: var(--gold);
  font: 30px/1 var(--f-title);
}
.d small {
  color: var(--sub);
  font-size: 14px;
}
.hero-skeleton {
  width: 220px;
  height: 46px;
}
.tips {
  display: grid;
  gap: 4px;
  justify-items: start;
  min-width: 0;
}
.tips p {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  color: var(--sub);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tips p b {
  color: var(--text);
}
.reward {
  justify-self: start;
  padding: 2px 10px;
  background: color-mix(in srgb, var(--gold) 14%, transparent);
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font-size: 12px;
  font-weight: 700;
}
.facts {
  display: flex;
  margin: 0;
}
.facts div {
  display: grid;
  padding: 0 14px;
  border-left: 1px solid var(--panel-line);
  text-align: center;
}
.facts dt {
  color: var(--sub);
  font-size: 11.5px;
}
.facts dd {
  margin: 0;
  font: 19px var(--f-title);
  font-variant-numeric: tabular-nums;
}

.main {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}


/* 진행도 칸이 남는 높이를 갖고, 장보기는 재료 10종 자리로 높이를 고정한다 */
.side {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 0;
}
.side > .panel:first-child {
  display: flex;
  flex-direction: column;
}
.foot {
  margin: 0;
  font-size: 12px;
}
/* 낮은 화면에서는 여백과 글자를 줄여 한 화면에 담는다 */
@media (max-height: 860px) {
  .meister {
    gap: 8px;
  }
  .hero {
    padding: 2px 16px;
  }
  .tips {
    gap: 2px;
  }
  .reward {
    padding: 0 10px;
  }
  .npc {
    width: 36px;
  }
  .d {
    font-size: 24px;
  }
}
@media (max-width: 1100px), (max-height: 700px) {
  .main {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    grid-template-rows: none;
  }
}
@media (max-width: 760px) {
  .hero {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .tips,
  .facts {
    grid-column: 1 / -1;
  }
}
</style>
