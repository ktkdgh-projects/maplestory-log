<script setup lang="ts">
import type { LedgerSettings } from '#shared/types'

// 메소 내역·일별 기록·보스 수입 위쪽에 늘 같은 자리로 두는 줄: 보유 메소(맞추기)와 직접 등록
// 일별 기록은 그날 패널에서 직접 등록하므로 위쪽 버튼을 숨긴다
const props = withDefaults(defineProps<{ settings: LedgerSettings | null, addButton?: boolean }>(), { addButton: true })
const emit = defineEmits<{ changed: [] }>()

const settingsOpen = ref(false)
const entryOpen = ref(false)
const balance = computed(() => props.settings?.balance ?? null)
</script>

<template>
  <div class="wallet">
    <button type="button" class="balance" :title="balance ? `${formatDay(balance.checkedAt)}에 맞춘 ${formatKoreanNumber(balance.checked)}부터 계산 · 눌러서 다시 맞추기` : '보유 메소를 맞추면 지금 보유 메소를 보여 줘요'" @click="settingsOpen = true">
      <span class="balance-label">보유 메소</span>
      <b v-if="balance">{{ formatKoreanNumber(balance.current) }}</b>
      <span v-else class="balance-empty">맞추기</span>
      <span class="gear" aria-hidden="true">⚙</span>
    </button>
    <slot />
    <button v-if="addButton" type="button" class="add" @click="entryOpen = true">＋ 직접 등록</button>

    <LedgerSettingsModal v-model="settingsOpen" :settings="settings" @saved="emit('changed')" />
    <LedgerEntryModal v-model="entryOpen" :entry="null" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :balance="balance?.current ?? null" @saved="emit('changed')" />
  </div>
</template>

<style scoped>
.wallet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.balance {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  background: linear-gradient(90deg, rgb(242 193 78 / 0.14), var(--panel));
  border: 1px solid var(--gold);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), box-shadow var(--fast) ease;
}
.balance:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow);
}
.balance-label {
  color: var(--sub);
  font-size: 13px;
}
.balance b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.balance-empty {
  color: var(--gold);
  font-family: var(--f-title);
}
.gear {
  color: var(--sub);
}
.add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  margin-left: auto;
  padding: 0 16px;
  background: rgb(242 193 78 / 0.1);
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font: 15px var(--f-title);
  cursor: pointer;
  transition: background var(--fast) ease, box-shadow var(--fast) ease;
}
.add:hover {
  background: rgb(242 193 78 / 0.2);
  box-shadow: 0 0 12px rgb(242 193 78 / 0.3);
}
</style>
