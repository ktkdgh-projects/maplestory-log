<script setup lang="ts">
import type { GrowthDay } from '~/utils/growth'

const props = defineProps<{ days: GrowthDay[], imageUrl: string | null }>()
const selected = defineModel<number>({ required: true })

const GROUND = 40
const PLATFORM_SPACING = 48
const PLATFORM_MIN = 10
const PLATFORM_RANGE = 90

const fieldWidth = computed(() => `max(100%, ${props.days.length * PLATFORM_SPACING + 40}px)`)
const xOf = (i: number) => (props.days.length > 1 ? 4 + (i * 92) / (props.days.length - 1) : 50)

// 발판 높이로 그날 얻은 경험치를 보여준다. 높을수록 많이 얻은 날
const heights = computed(() => {
  const gains = props.days.map(d => Math.max(d.gainPercent ?? 0, 0))
  const max = Math.max(...gains)
  return gains.map(g => PLATFORM_MIN + (max > 0 ? (g / max) * PLATFORM_RANGE : 0))
})

const hopping = ref(false)
// 캐릭터 이미지는 왼쪽을 보고 있어서 오른쪽으로 갈 때만 뒤집는다
const facingRight = ref(false)
watch(selected, (next, prev) => {
  facingRight.value = next > prev
  hopping.value = false
  requestAnimationFrame(() => {
    hopping.value = true
  })
})

const day = computed(() => props.days[selected.value])
const x = computed(() => xOf(selected.value))
const standY = computed(() => GROUND + (heights.value[selected.value] ?? 0))
const bubbleX = computed(() => Math.min(Math.max(x.value, 16), 84))

// 좁은 화면에서는 필드가 가로로 스크롤되므로 고른 날이 화면 가운데 오게 한다
const scroller = ref<HTMLElement | null>(null)
function centerSelected(behavior: ScrollBehavior) {
  const el = scroller.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  el.scrollTo({ left: (el.scrollWidth * x.value) / 100 - el.clientWidth / 2, behavior })
}
onMounted(() => centerSelected('instant'))
watch(selected, () => centerSelected('smooth'))
</script>

<template>
  <div ref="scroller" class="scroll">
    <FieldScene height="auto" :width="fieldWidth" :style="{ '--ground-height': `${GROUND}px`, flex: 'none' }">
      <button
        v-for="(d, i) in days"
        :key="d.date"
        type="button"
        class="platform"
        :style="{ left: `${xOf(i)}%`, height: `${heights[i]}px`, animationDelay: `${i * 30}ms` }"
        :aria-pressed="selected === i"
        :aria-label="`${formatMonthDay(d.date)} 선택`"
        @click="selected = i"
      >
        <span>{{ Number(d.date.slice(8)) }}</span>
      </button>

      <div v-if="day" class="bubble" :style="{ left: `${bubbleX}%` }">
        <Transition name="fade" mode="out-in">
          <div :key="day.date">
            <b>{{ formatMonthDay(day.date) }} · LV.{{ day.level }}</b>
            <div>EXP {{ day.expRate.toFixed(3) }}% <span v-if="day.gainPercent !== null" class="gain">{{ formatSigned(day.gainPercent, n => `${n.toFixed(2)}%`) }}</span></div>
            <div v-if="day.gainExp !== null">경험치 {{ formatSigned(day.gainExp) }}</div>
            <div v-if="day.combatPower !== null">전투력 {{ formatKoreanNumber(day.combatPower) }}</div>
          </div>
        </Transition>
      </div>

      <div class="walker" :class="{ hop: hopping }" :style="{ left: `${x}%`, bottom: `${standY}px` }">
        <CharacterSprite v-if="imageUrl" :src="imageUrl" :scale="1.6" :flip="facingRight" />
      </div>
    </FieldScene>
  </div>
</template>

<style scoped>
.scroll {
  display: flex;
  flex: 1;
  min-height: 300px;
  overflow-x: auto;
  border-radius: 10px;
}
.platform {
  position: absolute;
  bottom: 40px;
  display: grid;
  align-items: start;
  justify-items: center;
  width: 34px;
  min-height: 10px;
  padding: 4px 0 0;
  transform: translateX(-50%);
  background: linear-gradient(var(--grass) 0 5px, var(--dirt) 5px);
  border: 1px solid var(--dirt-dark);
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  transform-origin: bottom;
  animation: rise-platform 0.6s var(--ease-spring) backwards;
  transition: filter var(--fast) ease, height 0.5s var(--ease-out);
}
@keyframes rise-platform {
  from { transform: translateX(-50%) scaleY(0); }
}
.platform::before {
  content: "";
  position: absolute;
  inset: -12px -6px -34px;
}
.platform:hover {
  filter: brightness(1.2);
}
.platform span {
  position: absolute;
  bottom: -30px;
  color: var(--text);
  font-family: var(--f-pixel);
  font-size: 11px;
  text-shadow: 0 1px 0 var(--dirt-dark);
}
.platform[aria-pressed="true"] {
  background: linear-gradient(var(--exp) 0 5px, var(--dirt) 5px);
  box-shadow: 0 0 14px rgb(232 212 77 / 0.6);
}
.platform[aria-pressed="true"] span {
  color: var(--exp);
}
.walker {
  position: absolute;
  z-index: 3;
  translate: -50% 0;
  pointer-events: none;
  transition: left 0.8s var(--ease-out), bottom 0.8s var(--ease-out);
}
.walker.hop {
  animation: hop 0.8s var(--ease-out);
}
@keyframes hop {
  30% { translate: -50% -26px; }
  60% { translate: -50% -8px; }
}
.bubble {
  position: absolute;
  top: 10px;
  z-index: 4;
  min-width: 150px;
  padding: 8px 12px;
  transform: translateX(-50%);
  background: rgb(14 17 28 / 0.92);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.3);
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
  transition: left 0.8s var(--ease-out);
}
.bubble b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.gain {
  margin-left: 4px;
}
</style>
