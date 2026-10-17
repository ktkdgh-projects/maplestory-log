<script setup lang="ts">
import type { MesoHistoryBoss, MesoHistoryRef, MesoHistoryRow } from '#shared/types'
import type { BossDifficulty } from '#shared/data/bosses'

defineProps<{ group: { name: string, list: MesoHistoryRow['children'], amount: number, loot: number }, open: boolean }>()
const emit = defineEmits<{ toggle: [], remove: [target: MesoHistoryRef, label: string, amount: number] }>()

const lootTotal = (boss: MesoHistoryBoss | undefined) => (boss?.loot ?? []).reduce((n, l) => n + l.net, 0)
</script>

<template>
  <li class="cgroup" :class="{ open }">
    <button type="button" class="cg-head" :aria-expanded="open" @click="emit('toggle')">
      <span class="child-dot" />
      <span class="cg-name">
        <span class="ellipsis cg-title"><b>{{ group.name }}</b> · {{ group.list.length }}마리</span>
        <span class="stack">
          <span v-for="(c, k) in group.list" :key="k" class="stack-item" :style="{ zIndex: k + 1 }"><LedgerBossEmblem :boss-id="c.boss!.bossId" :size="20" /></span>
        </span>
        <LedgerBossSplit v-if="group.loot" class="cg-split" :crystal="group.amount - group.loot" :loot="group.loot" equals />
      </span>
      <b class="child-amt gain">{{ formatSigned(group.amount) }}</b>
      <svg class="cg-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <div class="cg-wrap">
      <ul class="cg-list" :inert="!open">
        <li v-for="(c, k) in group.list" :key="k">
          <i class="diff" :style="{ background: DIFFICULTY_COLORS[c.boss!.difficulty as BossDifficulty] }" />
          <span class="boss-line">
            <span class="child-label ellipsis">{{ bossLabel(c.boss!.bossId, c.boss!.difficulty) }}</span>
            <LedgerBossSplit v-if="c.boss!.loot.length" class="boss-split" :crystal="c.boss!.meso" :loot="lootTotal(c.boss)" equals>
              <template #icons><LedgerLootIcon v-for="(l, j) in c.boss!.loot" :key="j" :item="l.item" :size="18" /></template>
            </LedgerBossSplit>
          </span>
          <b class="child-amt" :class="c.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(c.amount) }}</b>
          <button v-if="c.ref" type="button" class="child-del" title="지우기" :aria-label="`${c.label} 지우기`" @click="emit('remove', c.ref, c.label, c.amount)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
          <span v-else class="child-del-space" />
        </li>
      </ul>
    </div>
  </li>
</template>

<style scoped>
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.child-del svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.child-del,
.child-del-space {
  grid-column: 5;
  justify-self: end;
  width: 24px;
  height: 24px;
}
.child-del {
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 50%;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.child-del:hover {
  background: color-mix(in srgb, var(--loss) 12%, transparent);
  color: var(--loss);
}
.child-amt {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
/* 보스 캐릭터 줄: 위 줄과 같은 칸에 맞추고, 누르면 그 아래로 보스를 펼친다 */
.children li.cgroup {
  display: block;
  padding: 0;
}
.cg-head {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 120px 58px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 4px 0;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.cg-head:hover {
  background: color-mix(in srgb, var(--c) 7%, transparent);
}
.cg-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--sub);
}
.cg-name b {
  color: var(--text);
  font-weight: 400;
}
/* 칸은 줄어들 수 있고 그림은 제 크기로 넘쳐 다음 그림 밑에 깔린다 */
.stack {
  display: flex;
  flex: 1;
  min-width: 0;
  padding-right: 20px;
}
.stack-item {
  position: relative;
  flex: 0 1 22px;
  min-width: 6px;
  height: 20px;
}
.stack-item > * {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: -2px 0 5px rgb(0 0 0 / 0.5);
}
.cg-caret {
  grid-column: 5;
  justify-self: end;
  margin-right: 5px;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transition: transform var(--normal) var(--ease-out);
}
.cgroup.open .cg-caret {
  transform: rotate(180deg);
}
.cg-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--normal) var(--ease-out);
}
.cgroup.open .cg-wrap {
  grid-template-rows: 1fr;
}
.cg-list {
  min-height: 0;
  margin: 0;
  padding: 0 0 0 16px;
  overflow: hidden;
  list-style: none;
}
.cg-list li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 120px 58px;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
}
.cg-title {
  flex: none;
  max-width: 45%;
}
.cg-split,
.boss-split {
  flex: none;
  margin-left: auto;
  font-size: 12px;
}
.boss-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.boss-line .child-label {
  flex: none;
  max-width: 50%;
}
.diff {
  justify-self: center;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.child-dot {
  justify-self: center;
  width: 6px;
  height: 6px;
  background: var(--c);
  border-radius: 50%;
}
.child-label {
  color: var(--sub);
}
@media (max-width: 520px) {
  .cg-head,
  .cg-list li {
    grid-template-columns: 20px minmax(0, 1fr) auto 36px;
    gap: 8px;
  }
  .cg-name .stack,
  .cg-split,
  .boss-split {
    display: none;
  }
  .cg-caret {
    grid-column: 4;
    justify-self: center;
    margin: 0;
  }
  .child-del,
  .child-del-space {
    grid-column: 4;
    width: 32px;
    height: 32px;
  }
}
</style>
