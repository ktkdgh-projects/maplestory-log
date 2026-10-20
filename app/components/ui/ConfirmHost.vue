<script setup lang="ts">
// 레이아웃에 하나만 둔다
const { current, busy, failure, settle, confirm } = useConfirm()
const open = computed({
  get: () => !!current.value,
  set: (value) => {
    if (!value) settle(false)
  },
})
</script>

<template>
  <AppModal v-model="open" :title="current?.title ?? ''" :width="400">
    <div v-if="current" class="confirm">
      <div class="target">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
        </span>
        <span class="name">
          <b>{{ current.name }}</b>
          <small v-if="current.detail" class="muted ellipsis">{{ current.detail }}</small>
        </span>
        <b v-if="current.amount" class="amount" :class="current.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(current.amount) }}</b>
      </div>
      <!-- 실패하면 안내 글자 자리에 이유를 보여 줘서 칸이 늘지 않는다 -->
      <p class="note" :class="{ failed: failure }" :role="failure ? 'alert' : undefined">{{ failure || (current.note ?? '지우면 되돌릴 수 없어요.') }}</p>
      <div class="actions">
        <button type="button" class="btn ghost" :disabled="busy" @click="settle(false)">취소</button>
        <button type="button" class="btn danger-fill" :disabled="busy" @click="confirm">{{ busy ? '처리하는 중…' : current.action ?? '지우기' }}</button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.confirm {
  display: grid;
  gap: 14px;
  padding: 4px 2px 2px;
}
.target {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  background: color-mix(in srgb, var(--loss) 14%, transparent);
  border-radius: 50%;
  color: var(--loss);
}
.mark svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.name {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.name b {
  font-size: 15px;
  overflow-wrap: anywhere;
}
.name small {
  font-size: 12.5px;
}
.amount {
  flex: none;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.note {
  margin: 0;
  padding: 0 2px;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.5;
}
.note.failed {
  color: var(--loss);
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.actions .btn {
  min-height: 40px;
}
.danger-fill {
  background: var(--loss);
  border-color: var(--loss);
  color: var(--on-accent);
}
</style>
