<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'

const FEATURES = [
  { tag: 'AUTO', accent: 'gold', title: '매일 자동 스냅샷', text: '레벨·경험치·전투력을 매일 새벽 모아 날짜별로 쌓아요.' },
  { tag: 'FIELD', accent: 'green', title: '게임 화면 같은 기록', text: '날짜 발판 위를 캐릭터가 걸어가며 그날의 성장을 보여줘요.' },
  { tag: 'SAFE', accent: 'blue', title: '키는 암호화 보관', text: '키는 서버에만 암호화해 두고, 화면엔 끝 네 자리만 보여요.' },
] as const

const route = useRoute()
const { me } = await useMe()

const name = computed(() => (typeof route.query.name === 'string' ? route.query.name.trim() : '') || me.value?.main?.name || '')

const { data: character, error, status, execute } = useFetch<CharacterDetail>(
  () => `/api/character/${encodeURIComponent(name.value)}`,
  { immediate: !!name.value, watch: false },
)
watch(name, (value) => {
  if (value) execute()
})

useHead(() => ({ title: name.value ? `${name.value} · 메이플스토리로그` : '메이플스토리로그' }))
</script>

<template>
  <Transition name="fade" mode="out-in">
    <div v-if="!name" key="intro" class="intro fit">
      <FieldScene class="hero" height="auto" :leaves="9" style="--ground-height: 56px">
        <div class="hero-text">
          <p class="eyebrow">MAPLESTORY LOG</p>
          <h1>내 캐릭터의 하루하루를<br><em>게임 화면 그대로</em> 기록해요</h1>
          <p class="lead">넥슨 Open API 키만 등록하면 매일 자동으로 성장 기록이 쌓여요.</p>
          <div class="actions">
            <NuxtLink to="/login" class="btn">API 키 등록하기</NuxtLink>
            <NuxtLink to="/guide/api-key" class="btn ghost">키 발급 방법</NuxtLink>
          </div>
        </div>
      </FieldScene>
      <div class="features stagger">
        <GameWindow v-for="f in FEATURES" :key="f.tag" :title="f.title" :sub="f.tag" :accent="f.accent">
          <p class="muted">{{ f.text }}</p>
        </GameWindow>
      </div>
    </div>

    <div v-else-if="status === 'pending'" key="loading" class="board fit" aria-busy="true" aria-label="불러오는 중">
      <GameWindow title="캐릭터 정보" fill>
        <div class="skeleton grow" />
        <div class="skeleton" style="height: 20px; width: 70%" />
        <div class="skeleton" style="height: 16px" />
      </GameWindow>
      <GameWindow title="장비" accent="blue" fill>
        <div class="skeleton-slots">
          <div v-for="i in 25" :key="i" class="skeleton" />
        </div>
      </GameWindow>
      <GameWindow title="상세" accent="purple" fill>
        <div v-for="i in 8" :key="i" class="skeleton" style="height: 28px" />
      </GameWindow>
    </div>

    <GameWindow v-else-if="error" key="error" title="알림" accent="red">
      <p class="muted">{{ errorMessage(error) }}</p>
    </GameWindow>

    <div v-else-if="character" :key="character.ocid" class="board fit">
      <div class="column">
        <CharacterProfile :character="character" />
        <CharacterHighlights :character="character" />
      </div>
      <CharacterEquipment :presets="character.presets" :preset-no="character.presetNo" :extras="[character.title, character.android].filter(item => item !== null)" :image-url="character.imageUrl" :name="character.name">
        <CharacterBuildSummary :character="character" />
      </CharacterEquipment>
      <CharacterDetailTabs :character="character" />
    </div>
  </Transition>
</template>

<style scoped>
.intro {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hero {
  flex: 1;
  min-height: 340px;
  animation: rise-in 0.6s var(--ease-out) backwards;
}
.hero-text {
  position: absolute;
  inset: 0 0 56px;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 14px;
  padding: 24px clamp(20px, 6vw, 72px);
}
.eyebrow {
  margin: 0;
  color: rgb(255 255 255 / 0.9);
  font-family: var(--f-pixel);
  font-size: 13px;
  letter-spacing: 0.25em;
}
.hero h1 {
  margin: 0;
  color: #fff;
  font-family: var(--f-title);
  font-size: clamp(30px, 5vw, 56px);
  font-weight: 400;
  line-height: 1.15;
  text-shadow: 0 3px 0 rgb(14 17 28 / 0.45), 0 8px 24px rgb(14 17 28 / 0.35);
}
.hero em {
  background: linear-gradient(90deg, #ffe08a, #ffb347);
  background-clip: text;
  color: transparent;
  font-style: normal;
  text-shadow: none;
  filter: drop-shadow(0 3px 0 rgb(14 17 28 / 0.45));
}
.lead {
  margin: 0;
  color: rgb(255 255 255 / 0.92);
  font-size: clamp(15px, 1.6vw, 18px);
  text-shadow: 0 1px 6px rgb(14 17 28 / 0.5);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}
.grow {
  flex: 1;
  min-height: 220px;
}
.column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}
.skeleton-slots {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.skeleton-slots .skeleton {
  aspect-ratio: 1;
}
@media (min-width: 1100px) and (min-height: 700px) {
  .board {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.1fr) minmax(0, 1.1fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
  }
  .board > *,
  .column > :last-child {
    min-height: 0;
  }
  .column > :last-child {
    flex: 1;
  }
}
</style>
