<script setup lang="ts">
const props = defineProps<{ stats: { name: string, value: string }[] }>()

const GROUPS = [
  {
    title: '공격',
    tone: 'var(--loss)',
    names: ['최소 스탯공격력', '최대 스탯공격력', '데미지', '보스 몬스터 데미지', '최종 데미지', '방어율 무시', '크리티컬 확률', '크리티컬 데미지', '일반 몬스터 데미지', '속성 내성 무시', '상태이상 추가 데미지', '공격력', '마력'],
  },
  { title: '능력치', tone: 'var(--api)', names: ['STR', 'DEX', 'INT', 'LUK', 'HP', 'MP'] },
  { title: '생존 · 이동', tone: 'var(--gain)', names: ['방어력', '상태이상 내성', '스탠스', '이동속도', '점프력', '공격 속도'] },
  {
    title: '편의 · 성장',
    tone: 'var(--gold)',
    names: ['아이템 드롭률', '메소 획득량', '추가 경험치 획득', '버프 지속시간', '재사용 대기시간 감소 (초)', '재사용 대기시간 감소 (%)', '재사용 대기시간 미적용', '스타포스', '아케인포스', '어센틱포스'],
  },
]
const PERCENT = new Set(['데미지', '보스 몬스터 데미지', '최종 데미지', '방어율 무시', '크리티컬 확률', '크리티컬 데미지', '일반 몬스터 데미지', '속성 내성 무시', '상태이상 추가 데미지', '스탠스', '이동속도', '점프력', '아이템 드롭률', '메소 획득량', '추가 경험치 획득', '버프 지속시간', '재사용 대기시간 감소 (%)', '재사용 대기시간 미적용'])

const values = computed(() => new Map(props.stats.map(s => [s.name, s.value])))
const groups = computed(() => GROUPS.map(group => ({
  ...group,
  rows: group.names.flatMap((name) => {
    const raw = values.value.get(name)
    if (raw === undefined) return []
    const number = Number(raw)
    const text = Number.isFinite(number) ? number.toLocaleString('ko-KR') : raw
    return [{ name: name.replace('재사용 대기시간', '쿨감'), value: `${text}${PERCENT.has(name) ? '%' : name.endsWith('(초)') ? '초' : ''}` }]
  }),
})).filter(group => group.rows.length))
</script>

<template>
  <div class="groups">
    <section v-for="group in groups" :key="group.title" class="group" :style="{ '--tone': group.tone }">
      <h3>{{ group.title }}</h3>
      <dl>
        <div v-for="row in group.rows" :key="row.name">
          <dt class="ellipsis">{{ row.name }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  gap: 12px;
}
.group {
  padding: 10px 12px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 10%, var(--panel)), var(--panel));
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
h3 {
  margin: 0 0 6px;
  color: var(--tone);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  gap: 2px 18px;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px dashed rgb(58 67 102 / 0.6);
  font-size: 14px;
}
dt {
  min-width: 0;
  color: var(--sub);
}
dd {
  flex: none;
  margin: 0;
  font-family: var(--f-title);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
</style>
