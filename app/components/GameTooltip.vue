<script setup lang="ts">
import type { EquipmentItem, ItemOption } from '#shared/types'

const props = defineProps<{ item: EquipmentItem }>()

const gradeColor = computed(() => potentialGradeColor(props.item.potentialGrade))
const unit = (option: ItemOption) => (option.percent ? '%' : '')
// 게임 툴팁처럼 (기본 +추가옵션 +주문서 +스타포스) 순서로 나누고 0인 칸은 뺀다
const parts = (option: ItemOption) => [
  { value: option.base, kind: 'base' },
  { value: option.add, kind: 'add' },
  { value: option.etc, kind: 'etc' },
  { value: option.starforce, kind: 'star' },
  { value: option.exceptional, kind: 'exceptional' },
].filter((part, i) => i === 0 || part.value)
</script>

<template>
  <div class="tip" :style="{ '--frame': gradeColor ?? 'var(--tip-line)' }">
    <div v-if="item.starforce" class="stars">★ {{ item.starforce }}성</div>
    <div class="name">
      {{ item.name }}<span v-if="item.scrollUpgrade" class="upgrade"> (+{{ item.scrollUpgrade }})</span>
    </div>
    <div v-if="item.potentialGrade" class="grade-label" :style="{ color: gradeColor }">({{ item.potentialGrade }} 아이템)</div>

    <hr>
    <div class="meta">
      <span>{{ item.slot }}</span>
      <span v-if="item.requiredLevel">REQ LEV {{ item.requiredLevel }}</span>
    </div>

    <template v-if="item.options.length">
      <hr>
      <ul class="options">
        <li v-for="option in item.options" :key="option.label + option.percent">
          <span class="label">{{ option.label }} :</span>
          <span class="total">+{{ option.total }}{{ unit(option) }}</span>
          <span v-if="parts(option).length > 1" class="parts">
            (<template v-for="(part, i) in parts(option)" :key="part.kind"><span :class="part.kind">{{ i ? ' +' : '' }}{{ part.value }}{{ unit(option) }}</span></template>)
          </span>
        </li>
      </ul>
      <div class="upgrades">
        업그레이드 가능 횟수 : {{ item.scrollUpgradeable }}
        <span v-if="item.goldenHammer" class="hammer">(황금망치 적용)</span>
      </div>
    </template>

    <template v-if="item.potentialGrade">
      <hr>
      <div class="block">
        <span class="block-title" :style="{ color: gradeColor }">잠재옵션</span>
        <span v-for="(option, i) in item.potentials" :key="i">{{ option }}</span>
      </div>
    </template>
    <template v-if="item.additionalGrade">
      <hr>
      <div class="block">
        <span class="block-title" :style="{ color: potentialGradeColor(item.additionalGrade) }">에디셔널 잠재옵션</span>
        <span v-for="(option, i) in item.additionalPotentials" :key="i">{{ option }}</span>
      </div>
    </template>
    <template v-if="item.description">
      <hr>
      <p class="description">{{ item.description }}</p>
    </template>
    <template v-if="item.soul">
      <hr>
      <div class="block">
        <span class="block-title soul">소울</span>
        <span>{{ item.soul }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tip {
  display: grid;
  gap: 4px;
  width: 300px;
  padding: 12px 14px;
  background: rgb(10 12 22 / 0.96);
  border: 2px solid var(--frame);
  border-radius: 8px;
  box-shadow: 0 0 0 1px #000, 0 10px 30px rgb(0 0 0 / 0.5), 0 0 18px color-mix(in srgb, var(--frame) 30%, transparent);
  font-size: 13px;
  line-height: 1.5;
}
.stars {
  color: var(--exp);
  font-family: var(--f-title);
  font-size: 15px;
  text-align: center;
}
.name {
  font-family: var(--f-title);
  font-size: 19px;
  line-height: 1.25;
  text-align: center;
}
.upgrade {
  color: var(--gold);
}
.grade-label {
  font-size: 12px;
  text-align: center;
}
hr {
  width: 100%;
  margin: 4px 0;
  border: 0;
  border-top: 1px dashed #3a4366;
}
.meta {
  display: flex;
  justify-content: space-between;
  color: var(--sub);
  font-size: 12px;
}
.options {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.options li {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
}
.label {
  color: var(--text);
}
.total {
  color: #fff;
  font-weight: 700;
}
.parts {
  color: var(--sub);
}
.base { color: #fff; }
.add { color: #9ee95d; }
.etc { color: #b9a3ff; }
.star { color: #ffcc33; }
.exceptional { color: #ff7a7a; }
.upgrades {
  margin-top: 2px;
  color: var(--sub);
  font-size: 12px;
}
.hammer {
  color: var(--gold);
}
.block {
  display: grid;
  gap: 1px;
}
.block-title {
  font-family: var(--f-title);
  font-size: 14px;
}
.soul {
  color: #ffd27a;
}
.description {
  margin: 0;
  color: var(--sub);
  white-space: pre-line;
}
</style>
