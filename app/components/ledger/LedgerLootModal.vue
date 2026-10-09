<script setup lang="ts">
import type { BossClear, BossLoot } from '#shared/types'
import { dropsOf } from '#shared/data/bossDrops'

const props = defineProps<{ clear: BossClear | null, feeRate: number }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()


// 억 단위 글자로 들고 있다가 저장할 때 메소로 바꾼다. 수수료는 판 건마다 고르고, 처음엔 마지막에 고른 값으로 둔다
const picked = ref<{ item: string, eok: string, fee: number }[]>([])
const custom = ref('')
const busy = ref(false)
const failure = ref('')

const candidates = computed(() => (props.clear ? dropsOf(props.clear.bossId, props.clear.difficulty) : []))

watch(() => [open.value, props.clear?.id], () => {
  if (!open.value || !props.clear) return
  picked.value = props.clear.loot.map(l => ({ item: l.item, eok: l.price ? String(Math.round((l.price / EOK) * 100) / 100) : '', fee: l.fee }))
  custom.value = ''
  failure.value = ''
}, { immediate: true })

const toMeso = (eok: string) => (eok ? Math.round(Number(eok) * EOK) : null)

function toggle(item: string) {
  const i = picked.value.findIndex(p => p.item === item)
  if (i >= 0) picked.value.splice(i, 1)
  else picked.value.push({ item, eok: '', fee: props.feeRate })
}
function addCustom() {
  const item = custom.value.trim()
  if (item && !picked.value.some(p => p.item === item)) picked.value.push({ item, eok: '', fee: props.feeRate })
  custom.value = ''
}

async function save() {
  if (!props.clear) return
  busy.value = true
  failure.value = ''
  try {
    const loot: BossLoot[] = picked.value.map(p => ({ item: p.item, price: toMeso(p.eok), fee: p.fee }))
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
  <AppModal v-model="open" title="물욕템 기록">
    <template v-if="clear">
      <div class="who">
        <LedgerBossEmblem :boss-id="clear.bossId" :size="50" />
        <div>
          <b>{{ bossLabel(clear.bossId, clear.difficulty) }}</b>
          <small class="muted">{{ clear.name }} · {{ formatMonthDay(clear.date) }}</small>
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

      <form class="custom" @submit.prevent="addCustom">
        <input v-model="custom" class="field-input" maxlength="40" placeholder="다른 아이템 직접 적기" aria-label="아이템 이름">
        <button class="btn ghost compact">추가</button>
      </form>

      <ul v-if="picked.length" class="picked">
        <li v-for="p in picked" :key="p.item">
          <div class="line">
            <LedgerLootIcon :item="p.item" :size="26" />
            <span class="picked-name ellipsis">{{ p.item }}</span>
            <label class="price">
              <input v-model="p.eok" class="field-input" inputmode="decimal" placeholder="판 금액" :aria-label="`${p.item} 판매가 (억)`">
              <span>억</span>
            </label>
            <button type="button" class="remove" :aria-label="`${p.item} 빼기`" @click="toggle(p.item)">×</button>
          </div>
          <div v-if="toMeso(p.eok)" class="sale">
            <span class="sale-label">경매장 수수료</span>
            <div class="fees" role="radiogroup" :aria-label="`${p.item} 경매장 수수료`">
              <button
                v-for="f in AUCTION_FEES"
                :key="f.rate"
                type="button"
                role="radio"
                class="fee"
                :class="{ on: p.fee === f.rate }"
                :aria-checked="p.fee === f.rate"
                :title="f.label"
                @click="p.fee = f.rate"
              >
                {{ Math.round(f.rate * 100) }}%<small v-if="f.rate < DEFAULT_AUCTION_FEE"> MVP·PC방</small>
              </button>
            </div>
            <span class="net">받은 메소 <b>{{ formatKoreanNumber(lootNet({ item: p.item, price: toMeso(p.eok), fee: p.fee })) }}</b></span>
          </div>
        </li>
      </ul>
      <p class="footnote">경매장에 올린 금액을 적고 그때 수수료를 고르면 받은 메소만 잡은 날 보스 수입에 더해져요. 대금을 받을 때 MVP 실버 이상이거나 프리미엄 PC방이면 3%예요. 직접 쓰는 템이면 금액을 비워 두세요. 출처: 넥슨 공식 가이드·패치노트, 나무위키 보스 세트·보스 문서 (2026-10-09 확인)</p>

      <p v-if="failure" class="form-error">{{ failure }}</p>
      <div class="actions">
        <button type="button" class="btn ghost" @click="open = false">취소</button>
        <button type="button" class="btn" :disabled="busy" @click="save">저장</button>
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 0 40px;
  border-top: 1px dashed var(--panel-line);
  animation: fade-in 0.18s ease;
}
@keyframes fade-in {
  from { opacity: 0; }
}
.sale-label {
  color: var(--sub);
  font-size: 12px;
}
.fees {
  display: flex;
  gap: 4px;
}
.fee {
  padding: 3px 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.fee small {
  font-size: 11px;
}
.fee.on {
  background: rgb(242 193 78 / 0.15);
  border-color: var(--gold);
  color: var(--text);
}
.picked-name {
  flex: 1;
  min-width: 0;
  font-family: var(--f-title);
}
.price {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--sub);
}
.price .field-input {
  width: 110px;
  min-height: 34px;
  text-align: right;
}
.net {
  margin-left: auto;
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
</style>
