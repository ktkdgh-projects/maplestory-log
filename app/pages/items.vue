<script setup lang="ts">
import type { CharacterBrief, ItemSheet, ItemsResponse } from '#shared/types'

const { me } = await useMe()
const { data, error, refresh } = await useFetch<ItemsResponse>('/api/items', { immediate: !!me.value })

// 탭을 끄는 동안 순서를 바로 바꾸고, 놓으면 저장한다
const sheets = ref<ItemSheet[]>([])
watch(() => data.value?.sheets, (value) => {
  sheets.value = [...(value ?? [])]
}, { immediate: true })
const dragTab = ref<string | null>(null)
function tabOver(index: number) {
  const from = sheets.value.findIndex(s => s.id === dragTab.value)
  if (from < 0 || from === index) return
  const [moved] = sheets.value.splice(from, 1)
  sheets.value.splice(index, 0, moved!)
}
async function tabDrop() {
  dragTab.value = null
  const ids = sheets.value.map(s => s.id)
  if (ids.join() === (data.value?.sheets ?? []).map(s => s.id).join()) return
  await $fetch('/api/items/order', { method: 'PUT', body: { sheetIds: ids } }).catch((e) => {
    failure.value = errorMessage(e)
  })
  await refresh()
}
const activeId = ref<string | null>(sheets.value[0]?.id ?? null)
const active = computed(() => sheets.value.find(s => s.id === activeId.value) ?? null)

const totals = computed(() => itemTotals(sheets.value.flatMap(s => s.rows)))

const creating = ref(false)
const customTitle = ref('')
const candidates = ref<CharacterBrief[] | null>(null)
const busy = ref(false)
const failure = ref('')

async function openCreate() {
  creating.value = true
  failure.value = ''
  candidates.value ??= await $fetch<CharacterBrief[]>('/api/me/characters').catch((e) => {
    failure.value = errorMessage(e)
    return null
  })
}
async function createSheet(body: { ocid?: string, title?: string }) {
  busy.value = true
  failure.value = ''
  try {
    const { id } = await $fetch<{ id: string }>('/api/items/sheets', { method: 'POST', body })
    await refresh()
    activeId.value = id
    creating.value = false
    customTitle.value = ''
  }
  catch (e) {
    failure.value = errorMessage(e)
  }
  finally {
    busy.value = false
  }
}
async function onRemoved() {
  await refresh()
  activeId.value = sheets.value[0]?.id ?? null
}

const MODES = [{ key: 'sheets', label: '장비 결산' }, { key: 'enhance', label: '강화 기록' }] as const
const mode = ref<typeof MODES[number]['key']>('sheets')

useHead({ title: '장비 결산 · 메이플스토리로그' })
</script>

<template>
  <GameWindow v-if="!me" title="장비 결산">
    <p class="muted">장비 결산은 API 키를 등록한 사용자만 쓸 수 있어요. 기록은 본인만 볼 수 있어요.</p>
    <div><NuxtLink to="/login" class="btn">API 키 등록하기</NuxtLink></div>
  </GameWindow>

  <GameWindow v-else class="fit" title="장비 결산" :sub="mode === 'sheets' ? '판매는 경매장 수수료를 뺀 금액으로 계산해요' : '스타포스·큐브·잠재 재설정 기록 (넥슨 API)'" accent="red" fill>
    <div class="modes" role="tablist" aria-label="장비 결산 보기">
      <MenuButton v-for="m in MODES" :key="m.key" role="tab" :active="mode === m.key" :aria-selected="mode === m.key" @click="mode = m.key">{{ m.label }}</MenuButton>
    </div>

    <ItemsEnhance v-if="mode === 'enhance'" />
    <template v-else>
    <div class="overview stagger">
      <div class="tile" style="--tone: var(--gold)">
        <span class="tile-label">전체 들인 메소 (구매 + 강화)</span>
        <span class="tile-value">{{ formatKoreanNumber(totals.invest) }}</span>
      </div>
      <div class="tile" style="--tone: var(--gain)">
        <span class="tile-label">판매로 회수</span>
        <span class="tile-value">{{ formatKoreanNumber(totals.sell) }}</span>
      </div>
      <div class="tile" style="--tone: var(--loss)">
        <span class="tile-label">손익 (판매한 장비 {{ totals.sold }}개)</span>
        <span class="tile-value" :class="profitTone(totals.sold ? totals.net : null)">{{ totals.sold ? formatSigned(totals.net) : '-' }}</span>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="시트">
      <button
        v-for="(s, i) in sheets"
        :key="s.id"
        type="button"
        role="tab"
        class="tab"
        :class="{ folded: s.folded, dragging: dragTab === s.id }"
        draggable="true"
        title="끌어서 순서 바꾸기"
        @dragstart="dragTab = s.id"
        @dragover.prevent="tabOver(i)"
        @drop.prevent="tabDrop"
        @dragend="dragTab = null"
        :aria-selected="s.id === activeId && !creating"
        @click="activeId = s.id; creating = false"
      >
        {{ s.title }}<small v-if="s.folded"> 접음</small>      </button>
      <button type="button" class="tab add" :aria-selected="creating" @click="creating ? (creating = false) : openCreate()">+ 시트</button>
    </div>
    <p v-if="error || failure" class="form-error">{{ failure || errorMessage(error) }}</p>

    <Transition name="fade" mode="out-in">
      <div v-if="creating" key="create" class="create">
        <div class="create-col">
          <h3>내 캐릭터로 만들기</h3>
          <p class="muted small">연결하면 지금 낀 장비를 아이콘과 함께 한 번에 불러올 수 있어요.</p>
          <p v-if="!candidates" class="muted">캐릭터 목록을 불러오는 중이에요…</p>
          <CharacterPicker v-else :characters="candidates" :busy="busy" @pick="createSheet({ ocid: $event })" />
        </div>
        <form class="create-col" @submit.prevent="createSheet({ title: customTitle })">
          <h3>이름만으로 만들기</h3>
          <p class="muted small">자석펫, 거래 기록처럼 캐릭터와 상관없는 표를 만들 때 써요.</p>
          <input v-model="customTitle" class="field-input" maxlength="40" placeholder="예: 자석펫" required>
          <div><button class="btn" :disabled="busy">만들기</button></div>
        </form>
      </div>
      <ItemsSheet v-else-if="active" :key="active.id" :sheet="active" @changed="refresh" @removed="onRemoved" />
      <div v-else key="empty" class="empty">
        <img src="/favicon.svg" alt="" width="48" height="48">
        <p class="muted">캐릭터별로 장비 구매가와 큐브·스타포스 비용을 정리해 보세요.</p>
        <button type="button" class="btn" @click="openCreate">+ 첫 시트 만들기</button>
      </div>
    </Transition>
    </template>
  </GameWindow>
</template>

<style scoped>
.modes {
  display: flex;
  gap: 6px;
}
.overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 2px solid var(--win-line);
}
.tab {
  padding: 6px 16px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 16px;
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.tab:hover {
  color: var(--text);
}
.tab[aria-selected="true"] {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.tab.dragging {
  outline: 1px dashed var(--gold);
}
.tab.folded {
  text-decoration: line-through;
  opacity: 0.7;
}
.tab small {
  font-size: 11px;
}
.tab.add {
  border-style: dashed;
}
.create {
  display: grid;
  flex: 1;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  min-height: 0;
}
.create-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.small {
  font-size: 13px;
}
.empty {
  display: grid;
  flex: 1;
  place-content: center;
  justify-items: center;
  gap: 12px;
  text-align: center;
}
.empty img {
  animation: bob 2.4s ease-in-out infinite;
}
@media (max-width: 800px) {
  .overview,
  .create {
    grid-template-columns: 1fr;
  }
}
</style>
