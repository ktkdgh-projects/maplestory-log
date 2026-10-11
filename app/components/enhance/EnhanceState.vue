<script setup lang="ts">
// 받은 결과가 있으면 실패해도 결과는 두고 한 줄로만 알린다
defineProps<{ charactersLoaded: boolean, hasCharacters: boolean, failure: string, error: unknown, hasData: boolean }>()
const emit = defineEmits<{ retryCharacters: [], retry: [] }>()
</script>

<template>
  <div v-if="failure" class="state">
    <p class="form-error">{{ failure }}</p>
    <button type="button" class="btn ghost compact" @click="emit('retryCharacters')">캐릭터 다시 불러오기</button>
  </div>
  <div v-else-if="charactersLoaded && !hasCharacters" class="state empty">
    <p>계정에서 캐릭터를 찾지 못했어요.</p>
    <p class="muted">넥슨 API 키가 맞는지, 캐릭터가 있는 계정의 키인지 확인해 주세요.</p>
    <NuxtLink to="/me" class="btn ghost compact">내 정보로 가기</NuxtLink>
  </div>
  <div v-else-if="error" class="state" :class="{ inline: hasData }">
    <p class="form-error">{{ errorMessage(error) }}</p>
    <button type="button" class="btn ghost compact" @click="emit('retry')">다시 불러오기</button>
  </div>
  <div v-else-if="!hasData" class="state loading" aria-busy="true">
    <span class="skeleton" />
    <p class="muted">장비와 강화 기록을 불러오는 중이에요…</p>
  </div>
</template>

<style scoped>
.state {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.state p {
  margin: 0;
}
.state.inline {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  justify-items: stretch;
}
.empty {
  justify-items: center;
  padding: 32px 16px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  font-size: 14px;
  text-align: center;
}
.empty .muted {
  font-size: 13px;
}
.loading {
  justify-items: stretch;
}
.loading .skeleton {
  height: 160px;
}
</style>
