<script setup lang="ts">
import type { CharacterBrief, ItemSheet, ItemsResponse } from '#shared/types'

const { me } = await useMe()
const { getCachedData, revalidate } = useRevisitCache()
const { data, error, refresh } = await useFetch<ItemsResponse>('/api/items', { immediate: !!me.value, getCachedData })
revalidate(refresh)

const sheets = computed<ItemSheet[]>(() => data.value?.sheets ?? [])
async function reorderSheets(ids: string[]) {
  await $fetch('/api/items/order', { method: 'PUT', body: { sheetIds: ids } }).catch((e) => {
    failure.value = errorMessage(e)
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

useHead({ title: '장비 결산 · 메이플스토리로그' })
</script>

<template>
  <GameWindow v-if="!me" title="장비 결산">
    <p class="muted">장비 결산은 API 키를 등록한 사용자만 쓸 수 있어요. 기록은 본인만 볼 수 있어요.</p>
    <div><NuxtLink to="/login" class="btn">API 키 등록하기</NuxtLink></div>
  </GameWindow>

  <GameWindow v-else class="fit" title="장비 결산" sub="판매는 경매장 수수료를 뺀 금액으로 계산해요" accent="red" fill>
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
        <span class="tile-label">손익 · 판매 {{ totals.sold }}개</span>
        <span class="tile-value" :class="profitTone(totals.sold ? totals.net : null)">{{ totals.sold ? formatSigned(totals.net) : '-' }}</span>
      </div>
    </div>

    <p v-if="error || failure" class="form-error">{{ failure || errorMessage(error) }}</p>

    <AppModal v-model="creating" title="시트 만들기" :width="760">
      <div class="create">
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
    </AppModal>

    <Transition name="fade" mode="out-in">
      <ItemsSheet v-if="active" :key="active.id" :sheet="active" @changed="refresh" @removed="onRemoved">
        <template #tabs>
          <ItemsSheetTabs :sheets="sheets" :active-id="activeId" :creating="creating" @select="selectSheet" @create="toggleCreate" @reorder="reorderSheets" />
        </template>
      </ItemsSheet>
      <div v-else key="empty" class="empty">
        <img src="/favicon.svg" alt="" width="48" height="48">
        <p class="muted">캐릭터별로 장비 구매가와 큐브·스타포스 비용을 정리해 보세요.</p>
        <button type="button" class="btn" @click="openCreate">+ 첫 시트 만들기</button>
      </div>
    </Transition>
    <!-- 시트가 하나도 없을 때도 시트 탭은 아래에 둔다 -->
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
