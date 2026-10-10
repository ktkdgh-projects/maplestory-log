<script setup lang="ts">
// useConfirm().ask()로 띄우는 확인 모달. 레이아웃에 하나만 둔다
const { current, settle } = useConfirm()
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
        <span class="name">
          <b>{{ current.name }}</b>
          <small v-if="current.detail" class="muted">{{ current.detail }}</small>
        </span>
        <b v-if="current.amount" class="amount" :class="current.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(current.amount) }}</b>
      </div>
      <p class="note">{{ current.note ?? '지우면 되돌릴 수 없어요.' }}</p>
      <div class="actions">
        <button type="button" class="btn ghost compact" @click="settle(false)">취소</button>
        <button type="button" class="btn compact danger-fill" @click="settle(true)">{{ current.action ?? '지우기' }}</button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.confirm {
  display: grid;
  gap: 12px;
}
.target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--loss);
  border-radius: 8px;
}
.name {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.name b {
  overflow-wrap: anywhere;
}
.name small {
  font-size: 12px;
}
.amount {
  flex: none;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.note {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.danger-fill {
  background: var(--loss);
  border-color: var(--loss);
  color: #2a1210;
}
</style>
