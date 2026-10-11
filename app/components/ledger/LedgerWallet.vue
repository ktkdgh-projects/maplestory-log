<script setup lang="ts">
import type { LedgerSettings } from '#shared/types'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'

// 일별 기록은 그날 패널에서 직접 등록하므로 addButton을 끈다
const props = withDefaults(defineProps<{ settings: LedgerSettings | null, addButton?: boolean }>(), { addButton: true })
const emit = defineEmits<{ changed: [] }>()

const settingsOpen = ref(false)
const entryOpen = ref(false)
const balance = computed(() => props.settings?.balance ?? null)
</script>

<template>
  <div class="wallet">
    <button type="button" class="balance" :title="balance ? `${formatDay(balance.checkedAt)}에 맞춘 ${formatKoreanNumber(balance.checked)}부터 계산 · 눌러서 다시 맞추기` : '보유 메소를 맞추면 지금 보유 메소를 보여 드려요'" @click="settingsOpen = true">
      <span class="balance-label">보유 메소</span>
      <b v-if="balance">{{ formatKoreanNumber(balance.current) }}</b>
      <span v-else class="balance-empty">맞추기</span>
      <span class="gear" aria-hidden="true">⚙</span>
    </button>
    <span v-if="$slots.default" class="sources"><slot /></span>
    <button v-if="addButton" type="button" class="add" @click="entryOpen = true">+ 직접 등록</button>

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
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 14%, transparent), var(--panel));
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
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font: 15px var(--f-title);
  cursor: pointer;
  transition: background var(--fast) ease, box-shadow var(--fast) ease;
}
.add:hover {
  background: color-mix(in srgb, var(--gold) 20%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 30%, transparent);
}
.sources {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sub);
  font-size: 13px;
}
.sources :deep(.badge) {
  padding: 2px 6px;
  font-size: 11px;
}
@media (max-width: 520px) {
  .balance {
    flex: 1 1 auto;
    white-space: nowrap;
  }
  /* 출처 표시는 아래 줄로 내려 보유 메소 칸이 눌리지 않게 한다 */
  .sources {
    order: 3;
    width: 100%;
  }
  .balance b {
    font-size: 17px;
    white-space: nowrap;
  }
  .add {
    min-height: 40px;
    padding: 0 14px;
    font-size: 14px;
  }
}
</style>
