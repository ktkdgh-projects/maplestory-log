<script setup lang="ts">
import type { MesoHistoryRef, MesoHistoryRow } from '#shared/types'
import { bossOrder } from '#shared/data/bosses'

const props = defineProps<{ row: MesoHistoryRow, date: string, kind: { label: string, color: string, icon: string }, open: boolean, openGroup: string | null }>()
const emit = defineEmits<{ pick: [], toggleGroup: [key: string], remove: [target: MesoHistoryRef, label: string, amount: number, date: string] }>()

const source = computed(() => {
  const { kind } = props.row
  if (kind === 'hunt' || kind === 'sale') return { path: '/ledger/days', query: { date: props.date } }
  if (kind === 'boss') return { path: '/ledger/bosses', query: { date: props.date } }
  if (kind === 'item') return { path: '/items' }
  return null
})

// 보스 묶음은 일별 기록처럼 캐릭터별 한 줄로 다시 묶고, 누르면 그 캐릭터가 잡은 보스를 펼친다
const bossGroups = computed(() => [...Map.groupBy(props.row.children, c => c.boss?.character ?? '')]
  .map(([name, list]) => ({ name, list: list.toSorted((a, b) => bossOrder(a.boss?.bossId ?? '') - bossOrder(b.boss?.bossId ?? '')), amount: list.reduce((n, c) => n + c.amount, 0), loot: list.reduce((n, c) => n + (c.boss?.loot ?? []).reduce((m, l) => m + l.net, 0), 0) }))
  .sort((a, b) => b.amount - a.amount))
const groupKey = (name: string) => `${props.row.key}:${name}`
</script>

<template>
  <div class="grp" :class="{ open, base: row.kind === 'base' }" :data-row="row.key" :style="{ '--c': kind.color }">
    <div class="row">
      <button type="button" class="row-main" :disabled="row.kind === 'base' || (!row.entry && !row.children.length)" :aria-expanded="row.children.length ? open : undefined" @click="emit('pick')">
        <span class="ic" :class="{ item: row.icon }">
          <img v-if="row.icon" :src="row.icon" alt="">
          <LedgerCoinIcon v-else-if="row.kind === 'hunt'" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path :d="kind.icon" /></svg>
        </span>
        <span class="what">
          <b class="title"><span class="ellipsis">{{ row.title }}</span><svg v-if="row.children.length" class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></b>
          <small class="ellipsis">{{ row.detail }}</small>
        </span>
        <span class="amt" :class="row.kind === 'base' ? '' : row.amount < 0 ? 'loss' : 'gain'">{{ row.kind === 'base' ? '기준' : formatSigned(row.amount) }}</span>
        <span class="bal">{{ row.balance === null ? '' : formatKoreanNumber(row.balance) }}</span>
      </button>
      <!-- 버튼이 없는 줄도 자리는 잡아 둔다 -->
      <span class="acts">
        <LedgerAct v-if="row.ref" kind="del" label="지우기" @click="emit('remove', row.ref, row.title, row.amount, date)" />
        <LedgerAct v-if="source" kind="go" :label="`${kind.label} 화면으로`" :to="source" />
      </span>
    </div>
    <div v-if="row.children.length" class="children-wrap">
      <ul class="children" :inert="!open">
        <template v-if="row.kind === 'boss'">
          <LedgerHistoryBossGroup
            v-for="g in bossGroups"
            :key="g.name"
            :group="g"
            :open="openGroup === groupKey(g.name)"
            @toggle="emit('toggleGroup', groupKey(g.name))"
            @remove="(target, label, amount) => emit('remove', target, label, amount, date)"
          />
        </template>
        <template v-else>
          <li v-for="(c, i) in row.children" :key="i">
            <img v-if="c.icon" :src="c.icon" alt="" class="child-icon">
            <span v-else class="child-dot" />
            <span class="child-label ellipsis">{{ c.label }}</span>
            <b class="child-amt" :class="c.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(c.amount) }}</b>
            <button v-if="c.ref" type="button" class="child-del" title="지우기" :aria-label="`${c.label} 지우기`" @click="emit('remove', c.ref, c.label, c.amount, date)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
            <span v-else class="child-del-space" />
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
/* 줄 + 펼친 내역을 한 카드로. 열리면 테두리가 이어진다 */
.grp {
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 8px;
  transition: border-color var(--normal) ease, box-shadow var(--normal) ease;
}
.grp.open {
  border-color: color-mix(in srgb, var(--c) 55%, var(--panel-line));
  border-left-color: var(--c);
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
/* 폭을 버튼 두 개 자리로 고정해 하나뿐인 줄도 금액이 흔들리지 않게 한다 */
.acts {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  width: 70px;
  padding-right: 8px;
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
.grp.base {
  background: repeating-linear-gradient(135deg, var(--panel), var(--panel) 8px, color-mix(in srgb, var(--tint) 1.5%, transparent) 8px, color-mix(in srgb, var(--tint) 1.5%, transparent) 16px);
}
.row-main {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto 120px;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 7px 4px 7px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row-main:disabled {
  cursor: default;
}
.row-main:not(:disabled):hover {
  background: color-mix(in srgb, var(--tint) 3%, transparent);
}
.ic {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: color-mix(in srgb, var(--c) 14%, var(--bar));
  border-radius: 7px;
  color: var(--c);
}
.ic.item {
  background: none;
}
.ic img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  image-rendering: pixelated;
}
.child-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  image-rendering: pixelated;
}
.ic svg:not(.coin) {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.what {
  display: grid;
  min-width: 0;
}
.what b {
  font-size: 14px;
}
.what small {
  color: var(--sub);
  font-size: 12px;
}
.title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.caret {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
  transition: transform var(--normal) var(--ease-out);
}
.grp.open .caret {
  transform: rotate(180deg);
}
.amt {
  font-family: var(--f-title);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.bal {
  color: var(--sub);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
/* 높이를 0fr ↔ 1fr로 옮겨 부드럽게 펼친다 */
.children-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--normal) var(--ease-out);
}
.grp.open .children-wrap {
  grid-template-rows: 1fr;
}
.children {
  display: grid;
  gap: 1px;
  min-height: 0;
  margin: 0;
  padding: 0 2px 0 48px;
  overflow: hidden;
  background: color-mix(in srgb, var(--sunk) 35%, transparent);
  list-style: none;
  font-size: 12.5px;
  opacity: 0;
  transition: opacity var(--normal) ease, padding var(--normal) var(--ease-out);
}
.grp.open .children {
  padding-block: 6px 8px;
  border-top: 1px dashed var(--panel-line);
  opacity: 1;
}
/* 위 줄과 같은 칸: 그림 · 이름 · 금액 · 잔액 자리 · 지우기 */
.children li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 120px 58px;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
}
.child-amt {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
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
  /* 좁으면 이름 줄을 통째로 쓰고, 금액은 덧말 줄 오른쪽으로 내린다. 잔액 칸은 숨긴다 */
  .row-main {
    grid-template-columns: 28px minmax(0, 1fr) auto;
    grid-template-areas: "ic title title" "ic detail amt";
    column-gap: 8px;
    row-gap: 1px;
    padding: 7px 2px 7px 8px;
  }
  .row-main > .ic {
    grid-area: ic;
  }
  .what {
    display: contents;
  }
  .what > .title {
    grid-area: title;
  }
  .what > small {
    grid-area: detail;
    align-self: center;
  }
  .amt {
    grid-area: amt;
    font-size: 14.5px;
  }
  .bal {
    display: none;
  }
  .acts {
    width: auto;
    min-width: 40px;
    padding-right: 4px;
  }
  .children {
    padding-left: 12px;
  }
  .children li {
    grid-template-columns: 20px minmax(0, 1fr) auto 36px;
    gap: 8px;
  }
  .child-del,
  .child-del-space {
    grid-column: 4;
    width: 32px;
    height: 32px;
  }
}
</style>
