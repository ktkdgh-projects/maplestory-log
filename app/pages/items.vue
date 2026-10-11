<script setup lang="ts">
import type { CharacterBrief, ItemSheet, ItemsResponse } from '#shared/types'
import { itemTotals } from '#shared/calc/items'
import { hasMvpFee } from '#shared/calc/meso'

const { me } = await useMe()
const { getCachedData, revalidate } = useRevisitCache()
const { data, error, refresh } = await useFetch<ItemsResponse>('/api/items', { immediate: !!me.value, getCachedData })
revalidate(refresh)

const sheets = computed<ItemSheet[]>(() => data.value?.sheets ?? [])
const activeId = ref<string | null>(sheets.value[0]?.id ?? null)
// 보던 시트가 다른 기기에서 지워졌으면 첫 시트를 보여 준다
const active = computed(() => sheets.value.find(s => s.id === activeId.value) ?? sheets.value[0] ?? null)
const pageError = ref('')
async function reorderSheets(ids: string[]) {
  pageError.value = ''
  await $fetch('/api/items/order', { method: 'PUT', body: { sheetIds: ids } }).catch((e) => {
    pageError.value = errorMessage(e)
  })
  await refresh()
}
function selectSheet(id: string) {
  activeId.value = id
  creating.value = false
}
function toggleCreate() {
  if (creating.value) creating.value = false
  else openCreate()
}
const mvpFee = computed(() => hasMvpFee(me.value?.mvpDiscount))

const totals = computed(() => itemTotals(sheets.value.flatMap(s => s.rows)))

const creating = ref(false)
const customTitle = ref('')
const candidates = ref<CharacterBrief[] | null>(null)
const candidatesError = ref('')
const busy = ref(false)
const failure = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

async function loadCandidates() {
  candidatesError.value = ''
  try {
    candidates.value = await $fetch<CharacterBrief[]>('/api/me/characters')
  }
  catch (e) {
    candidatesError.value = errorMessage(e)
  }
}
function openCreate() {
  creating.value = true
  failure.value = ''
  if (!candidates.value) loadCandidates()
}
function createByTitle() {
  if (!customTitle.value.trim()) {
    failure.value = '시트 이름을 적어 주세요.'
    titleInput.value?.focus()
    return
  }
  return createSheet({ title: customTitle.value })
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

useHead({ title: '장비 결산 · 메이플스토리로그' })
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.items" />

  <GameWindow v-else class="fit" title="장비 결산" :sub="mvpFee ? '판매는 MVP 수수료 3%를 뺀 금액으로 계산해요' : '판매는 경매장 수수료를 뺀 금액으로 계산해요'" accent="red" fill>
    <div class="overview stagger">
      <div class="tile" style="--tone: var(--gold)">
        <span class="tile-label">전체 들인 메소</span>
        <span class="tile-value">{{ formatKoreanNumber(totals.invest) }}</span>
      </div>
      <div class="tile" style="--tone: var(--gain)">
        <span class="tile-label">판매로 회수</span>
        <span class="tile-value">{{ formatKoreanNumber(totals.sell) }}</span>
      </div>
      <div class="tile" style="--tone: var(--loss)">
        <span class="tile-label">{{ totals.sold ? `손익 · 판매한 ${totals.sold}개` : '손익' }}</span>
        <span v-if="totals.sold" class="tile-value" :class="profitTone(totals.net)">{{ formatSigned(totals.net) }}</span>
        <span v-else class="tile-value empty-value">판매가를 적으면 계산돼요</span>
      </div>
    </div>

    <div v-if="error" class="form-error retry">
      <span>{{ errorMessage(error) }}</span>
      <button type="button" class="btn ghost compact" @click="refresh()">다시 불러오기</button>
    </div>
    <p v-else-if="pageError" class="form-error">{{ pageError }}</p>

    <AppModal v-model="creating" title="시트 만들기" :width="720">
      <div class="create">
        <div class="create-col">
          <h3>내 캐릭터로 만들기</h3>
          <p class="muted small">연결하면 지금 낀 장비를 아이콘과 함께 한 번에 불러올 수 있어요.</p>
          <div v-if="candidatesError" class="load-error">
            <p class="muted small">{{ candidatesError }}</p>
            <button type="button" class="btn ghost compact" @click="loadCandidates">다시 불러오기</button>
          </div>
          <div v-else-if="!candidates" class="skeleton-list" aria-busy="true" aria-label="캐릭터 목록 불러오는 중">
            <div class="skeleton" style="height: 44px" />
            <div v-for="i in 4" :key="i" class="skeleton" style="height: 52px" />
          </div>
          <CharacterPicker v-else :characters="candidates" :busy="busy" @pick="createSheet({ ocid: $event })" />
        </div>
        <form class="create-col" novalidate @submit.prevent="createByTitle">
          <h3>이름만으로 만들기</h3>
          <p class="muted small">자석펫, 거래 기록처럼 캐릭터와 상관없는 표를 만들 때 써요.</p>
          <input ref="titleInput" v-model="customTitle" class="field-input" maxlength="40" placeholder="예: 자석펫" aria-label="시트 이름" @input="failure = ''">
          <div><button class="btn" :disabled="busy">만들기</button></div>
        </form>
      </div>
      <!-- 늘 자리를 잡아 둬서 오류가 떠도 밀리지 않는다 -->
      <p class="hint-line" role="status">{{ failure || ' ' }}</p>
    </AppModal>

    <Transition name="fade" mode="out-in">
      <ItemsSheet v-if="active" :key="active.id" :sheet="active" @changed="refresh" @removed="onRemoved">
        <template #tabs>
          <ItemsSheetTabs :sheets="sheets" :active-id="active.id" :creating="creating" @select="selectSheet" @create="toggleCreate" @reorder="reorderSheets" />
        </template>
      </ItemsSheet>
      <div v-else key="empty" class="empty">
        <img src="/favicon.svg" alt="" width="48" height="48">
        <p class="muted">캐릭터별로 장비 구매가와 큐브·스타포스 비용을 정리해 보세요.</p>
        <button type="button" class="btn" @click="openCreate">+ 첫 시트 만들기</button>
      </div>
    </Transition>
    <!-- 시트가 없을 때도 탭은 아래에 둔다 -->
    <ItemsSheetTabs v-if="!active" class="bottom-tabs" :sheets="sheets" :active-id="activeId" :creating="creating" @select="selectSheet" @create="toggleCreate" @reorder="reorderSheets" />
  </GameWindow>
</template>

<style scoped>
.overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.bottom-tabs {
  margin-top: auto;
}
.create {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
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
.empty-value {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 14px;
  line-height: 1.9;
}
.retry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.load-error {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.skeleton-list {
  display: grid;
  gap: 6px;
}
.hint-line {
  min-height: 20px;
  margin: 8px 0 0;
  color: var(--loss);
  font-size: 13px;
  line-height: 20px;
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
  .create {
    grid-template-columns: 1fr;
  }
}
/* 휴대폰: 요약은 메소 내역처럼 한 줄에 이름 왼쪽·금액 오른쪽으로 쌓아 금액이 꺾이지 않게 한다 */
@media (max-width: 640px) {
  .overview {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .overview .tile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
  }
  .overview .tile-value {
    font-size: 17px;
    white-space: nowrap;
  }
  .overview .empty-value {
    font-size: 12.5px;
  }
}
</style>
