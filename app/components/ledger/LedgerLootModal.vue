<script setup lang="ts">
import type { BossClear, BossLoot } from '#shared/types'
import { dropsOf } from '#shared/data/bossDrops'
import { lootNet } from '#shared/calc/boss'

const props = defineProps<{ clear: BossClear | null, feeRate: number }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

// saved: 이미 저장된 물욕템이라 열기만 해선 그때 고른 수수료를 바꾸지 않는다
const picked = ref<{ item: string, price: number | null, fee: number, saved: boolean }[]>([])
const custom = ref('')
const busy = ref(false)
const failure = ref('')

const candidates = computed(() => (props.clear ? dropsOf(props.clear.bossId, props.clear.difficulty) : []))

watch(() => [open.value, props.clear?.id], () => {
  if (!open.value || !props.clear) return
  picked.value = props.clear.loot.map(l => ({ item: l.item, price: l.price, fee: l.fee, saved: true }))
  custom.value = ''
  failure.value = ''
}, { immediate: true })

function toggle(item: string) {
  const i = picked.value.findIndex(p => p.item === item)
  if (i >= 0) picked.value.splice(i, 1)
  else picked.value.push({ item, price: null, fee: props.feeRate, saved: false })
}
function addCustom() {
  const item = custom.value.trim()
  if (item && !picked.value.some(p => p.item === item)) picked.value.push({ item, price: null, fee: props.feeRate, saved: false })
  custom.value = ''
}

async function save() {
  if (!props.clear) return
  busy.value = true
  failure.value = ''
  try {
    const loot: BossLoot[] = picked.value.map(p => ({ item: p.item, price: p.price || null, fee: p.fee }))
    await $fetch(`/api/ledger/clears/${props.clear.id}`, { method: 'PATCH', body: { loot } })
    emit('saved')
    open.value = false
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" title="물욕템 기록" :width="540">
    <template v-if="clear">
      <div class="who">
        <LedgerBossEmblem :boss-id="clear.bossId" :size="50" />
        <div>
          <b>{{ bossLabel(clear.bossId, clear.difficulty) }}</b>
          <small class="muted">{{ clear.name }} · {{ formatDay(clear.date) }}</small>
        </div>
      </div>

      <div v-if="candidates.length" class="choices">
        <span class="label">이 보스·난이도에서 나오는 물욕템</span>
        <div class="chips">
          <button
            v-for="d in candidates"
            :key="d.item"
            type="button"
            class="chip"
            :class="{ on: picked.some(p => p.item === d.item) }"
            :style="{ '--tone': DROP_SET_TONES[d.set] }"
            :aria-pressed="picked.some(p => p.item === d.item)"
            @click="toggle(d.item)"
          >
            <LedgerLootIcon :item="d.item" :size="30" />
            <span class="chip-text">
              <small>{{ d.set }} · {{ d.part }}</small>
              {{ d.item }}
            </span>
          </button>
        </div>
      </div>
      <p v-else class="muted small">이 보스·난이도는 드롭표에 있는 장신구가 없어요. 아래에 직접 적을 수 있어요.</p>

      <form class="custom" @submit.prevent="addCustom" novalidate>
        <input v-model="custom" class="field-input" maxlength="40" placeholder="다른 아이템 직접 적기" aria-label="아이템 이름">
        <button class="btn ghost compact">추가</button>
      </form>

      <ul v-if="picked.length" class="picked">
        <li v-for="(p, i) in picked" :key="p.item">
          <div class="line">
            <LedgerLootIcon :item="p.item" :size="26" />
            <span class="picked-name ellipsis">{{ p.item }}</span>
            <button type="button" class="remove" :aria-label="`${p.item} 빼기`" @click="toggle(p.item)">×</button>
          </div>
          <div class="sale">
            <MesoInput :id="`loot-price-${i}`" v-model="p.price" label="경매장에 올린 금액" />
            <!-- 금액을 적기 전에도 자리를 잡아 둬서 칸이 들썩이지 않는다 -->
            <div class="sale-side" :class="{ off: !p.price }" :inert="!p.price">
              <LedgerFeeLine v-model="p.fee" :keep="p.saved" />
              <span class="net">받은 메소 <b>{{ formatKoreanNumber(lootNet({ item: p.item, price: p.price, fee: p.fee })) }}</b></span>
            </div>
          </div>
        </li>
      </ul>
      <div class="foot-note">
        <p class="footnote">판 템은 받은 메소만 그날 보스 수입에 더해져요. 직접 쓰는 템은 금액을 비워 두세요.</p>
        <HoverInfo title="드롭표 출처" align="right">
          <span class="info-dot" aria-label="드롭표 출처">?</span>
          <template #info>
            <span class="info-text">넥슨 공식 가이드·패치노트, 나무위키 보스 세트·보스 문서 (2026-10-09 확인)</span>
          </template>
        </HoverInfo>
      </div>

      <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
      <div class="actions">
        <button type="button" class="btn ghost compact" @click="open = false">취소</button>
        <button type="button" class="btn compact" :disabled="busy" @click="save">저장</button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.who {
  display: flex;
  align-items: center;
  gap: 12px;
}
.who > div {
  display: grid;
}
.who b {
  font-family: var(--f-title);
  font-size: 20px;
  font-weight: 400;
}
.label {
  color: var(--sub);
  font-size: 13px;
}
.choices {
  display: grid;
  gap: 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip-text {
  display: grid;
  gap: 1px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, transform var(--fast) var(--ease-spring);
}
.chip small {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 11px;
}
.chip:hover {
  transform: translateY(-2px);
  border-color: var(--tone);
}
.chip.on {
  background: color-mix(in srgb, var(--tone) 20%, var(--bar));
  border-color: var(--tone);
  box-shadow: 0 0 12px color-mix(in srgb, var(--tone) 35%, transparent);
}
.small {
  font-size: 14px;
}
.custom {
  display: flex;
  gap: 6px;
}
.custom .field-input {
  min-height: 38px;
}
.picked {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.picked li {
  display: grid;
  gap: 6px;
  padding: 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sale {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding-top: 6px;
  border-top: 1px dashed var(--panel-line);
}
.sale :deep(.field-input) {
  min-height: 36px;
}
.sale-side {
  display: grid;
  justify-items: end;
  gap: 4px;
  transition: opacity var(--fast) ease;
}
.sale-side.off {
  visibility: hidden;
  opacity: 0;
}
.foot-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.foot-note .footnote {
  flex: 1;
}
.info-dot {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  color: var(--sub);
  font-size: 12px;
  cursor: help;
}
.info-text {
  display: block;
  min-width: 220px;
  color: var(--sub);
  font-size: 12px;
}
.hint {
  contain: inline-size;
  height: 18px;
  margin: 0;
  overflow: hidden;
  color: var(--loss);
  font-size: 12.5px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
}
.hint.show {
  opacity: 1;
}
.picked-name {
  flex: 1;
  min-width: 0;
  font-family: var(--f-title);
}
.net {
  color: var(--sub);
  font-size: 12px;
}
.net b {
  margin-left: 4px;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.remove {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--sub);
  cursor: pointer;
}
.remove:hover {
  border-color: var(--loss);
  color: var(--loss);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 480px) {
  .sale {
    grid-template-columns: 1fr;
  }
  .sale-side {
    grid-auto-flow: column;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
