<script setup lang="ts">
import type { UnionResponse } from '#shared/types'

const props = defineProps<{ ocid: string, world: string, unionLevel: number | null, unionGrade: string | null }>()

const POLL_MS = 2500
const TIERS: [string, string][] = [['슈프림', 'var(--loss)'], ['그랜드 마스터', 'var(--gold)'], ['마스터', 'var(--purple)'], ['베테랑', 'var(--api)'], ['노비스', 'var(--tip-line)']]
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

const world = ref(props.world)
const showHidden = ref(false)
const { data, error, refresh } = useFetch<UnionResponse>(() => `/api/union/${props.ocid}`, { query: { world }, server: false, lazy: true })

// 불러오기 전엔 캐릭터 정보에 있던 이 월드의 유니온 등급·레벨을 먼저 보여 준다
const unionGrade = computed(() => data.value?.unionGrade ?? (world.value === props.world ? props.unionGrade : null))
const unionLevel = computed(() => data.value?.unionLevel ?? (world.value === props.world ? props.unionLevel : null))

// 유니온 등급 그림은 API로 오지 않아서 등급 이름으로 직접 그린 엠블럼을 쓴다
const grade = computed(() => {
  const name = unionGrade.value ?? ''
  const [tier, color] = TIERS.find(([t]) => name.startsWith(t)) ?? ['유니온', 'var(--tip-line)']
  const step = Number(name.match(/(\d+)$/)?.[1] ?? 0)
  return { tier, color, roman: ROMAN[step] ?? String(step) }
})

let timer: ReturnType<typeof setTimeout> | undefined
watch(() => data.value?.pending, (pending) => {
  clearTimeout(timer)
  if (pending) timer = setTimeout(refresh, POLL_MS)
})
onBeforeUnmount(() => clearTimeout(timer))

// 월드를 바꾸는 동안 data가 비어도 월드 줄은 그대로 둔다
const worlds = ref<UnionResponse['worlds']>([])
watch(data, (value) => {
  if (value?.worlds.length) worlds.value = value.worlds
})
const visibleWorlds = computed(() => worlds.value.filter(w => w.active || showHidden.value || w.name === world.value))
const hiddenCount = computed(() => worlds.value.filter(w => !w.active).length)

const raider = computed(() => data.value?.mode === 'raider')
const roster = computed<{ level: number }[]>(() => (raider.value ? data.value!.raiders : data.value?.members ?? []))
const totalLevel = computed(() => roster.value.reduce((sum, m) => sum + m.level, 0))
const count = computed(() => roster.value.length)
const TYPE_COLORS: Record<string, string> = { 전사: 'var(--loss)', 마법사: 'var(--api)', 궁수: 'var(--gain)', 도적: 'var(--calc)', 해적: 'var(--gold-warm)' }
const typeColor = (type: string) => TYPE_COLORS[type] ?? 'var(--sub)'
</script>

<template>
  <div class="union">
    <div v-if="visibleWorlds.length > 1 || hiddenCount" class="worlds" role="group" aria-label="월드">
      <MenuButton v-for="w in visibleWorlds" :key="w.name" :active="world === w.name" :class="{ closed: !w.active }" @click="world = w.name">{{ w.name }} <small>{{ w.active ? w.count : '종료' }}</small></MenuButton>
      <button v-if="hiddenCount" type="button" class="toggle" @click="showHidden = !showHidden">{{ showHidden ? '종료된 월드 숨기기' : `종료된 월드 ${hiddenCount}개 보기` }}</button>
    </div>
    <div class="head" :style="{ '--tone': grade.color }">
      <div class="emblem" aria-hidden="true">
        <span>{{ grade.roman }}</span>
      </div>
      <div class="head-info">
        <span class="grade">{{ unionGrade ?? '유니온 정보 없음' }}</span>
        <span class="level">Lv.{{ unionLevel?.toLocaleString('ko-KR') ?? '-' }}</span>
        <!-- 이미지를 받는 동안 남은 수도 같은 줄에 붙여 줄이 생겼다 사라지지 않게 한다 -->
        <span class="muted small ellipsis">
          <template v-if="data && count">{{ raider ? `공격대원 ${count}명` : `${data.world} · 캐릭터 ${count}명` }} · 레벨 합 {{ totalLevel.toLocaleString('ko-KR') }}<template v-if="!raider && data.pending"> · 이미지 {{ data.pending }}명 남음</template></template>
          <template v-else>&nbsp;</template>
        </span>
      </div>
    </div>

    <div v-if="error" class="retry">
      <p class="muted small">{{ errorMessage(error, '유니온 정보를 불러오지 못했어요.') }}</p>
      <button type="button" class="btn ghost compact" @click="refresh()">다시 불러오기</button>
    </div>
    <ul v-else-if="!data" class="members" aria-busy="true" aria-label="캐릭터 목록 불러오는 중">
      <li v-for="i in 12" :key="i" class="ghost">
        <div class="face"><span class="skeleton" /></div>
        <span class="skeleton" style="width: 70%; height: 14px" />
        <span class="skeleton" style="width: 85%; height: 12px" />
      </li>
    </ul>
    <template v-else-if="raider">
      <p class="muted small">{{ data.raiders.length ? '공격대에 배치된 캐릭터예요. 다른 계정은 넥슨 API가 이름·이미지를 주지 않아 직업과 레벨만 보여요.' : '다른 계정의 캐릭터 목록은 넥슨 API로 받을 수 없어 유니온 등급과 레벨만 보여요.' }}</p>
      <ul v-if="data.raiders.length" class="raiders stagger">
        <li v-for="(m, i) in data.raiders" :key="i" :style="{ '--tone': typeColor(m.type) }">
          <span class="type">{{ m.type }}</span>
          <b class="ellipsis" :title="m.job">{{ m.job }}</b>
          <span class="lv">Lv.{{ m.level }}</span>
        </li>
      </ul>
    </template>
    <template v-else>
      <ul class="members stagger">
        <li v-for="m in data.members" :key="m.ocid" :class="{ me: m.ocid === ocid }">
          <div class="face">
            <CharacterThumb v-if="m.imageUrl" :src="m.imageUrl" :height="104" />
            <span v-else class="skeleton" />
          </div>
          <b class="ellipsis">{{ m.name }}</b>
          <span class="muted ellipsis">Lv.{{ m.level }} · {{ m.job }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.union {
  display: grid;
  gap: 12px;
}
.worlds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.worlds .menu-btn {
  min-height: 36px;
  padding: 0 10px;
  font-size: 14px;
}
.worlds small {
  opacity: 0.7;
  font-size: 11px;
}
.worlds .closed {
  opacity: 0.6;
}
.toggle {
  min-height: 36px;
  padding: 0 10px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.toggle:hover {
  color: var(--text);
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 18%, var(--panel)), var(--panel));
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.emblem {
  display: grid;
  flex: none;
  place-items: center;
  width: 60px;
  height: 66px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--tone) 85%, #fff), color-mix(in srgb, var(--tone) 60%, #000));
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  filter: drop-shadow(0 0 8px var(--tone));
}
.emblem span {
  color: #fff;
  font-family: var(--f-title);
  font-size: 22px;
  text-shadow: 0 2px 0 rgb(0 0 0 / 0.4);
}
.head-info {
  display: grid;
  min-width: 0;
}
.grade {
  color: var(--tone);
  font-family: var(--f-title);
  font-size: 19px;
}
.level {
  font-family: var(--f-title);
  font-size: 24px;
}
.retry {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.members li.ghost {
  gap: 6px;
}
.members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.members li {
  display: grid;
  justify-items: center;
  gap: 1px;
  min-width: 0;
  padding: 6px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
}
.members li.me {
  border-color: var(--gold);
  box-shadow: var(--glow);
}
.members li > * {
  max-width: 100%;
}
.members .muted {
  font-size: 11px;
}
.raiders {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.raiders li {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 7px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
.raiders .type {
  color: var(--tone);
  font-size: 11px;
  font-weight: 700;
}
.raiders b {
  font-size: 13.5px;
}
.raiders .lv {
  color: var(--sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.face {
  width: 100%;
  height: 104px;
  overflow: hidden;
}
.face .skeleton {
  display: block;
  margin: 20px auto 0;
  width: 48px;
  height: 64px;
}
</style>
