<script setup lang="ts">
const route = useRoute()
const input = ref(typeof route.query.name === 'string' ? route.query.name : '')

watch(() => route.query.name, (name) => {
  input.value = typeof name === 'string' ? name : ''
})

function search() {
  const name = input.value.trim()
  if (name) navigateTo({ path: '/', query: { name } })
}
</script>

<template>
  <form class="search" role="search" @submit.prevent="search">
    <label for="header-search" class="sr-only">캐릭터 이름</label>
    <span class="icon" aria-hidden="true">⌕</span>
    <input id="header-search" v-model="input" class="field-input" placeholder="캐릭터 이름으로 검색" maxlength="20" autocomplete="off">
    <button type="submit" class="btn">검색</button>
  </form>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  flex: 1 1 260px;
  gap: 6px;
  max-width: 420px;
}
.icon {
  position: absolute;
  top: 50%;
  left: 12px;
  translate: 0 -50%;
  color: var(--sub);
  font-size: 20px;
  pointer-events: none;
}
.field-input {
  min-height: 40px;
  padding-left: 36px;
}
.btn {
  min-height: 40px;
  padding: 0 16px;
}
</style>
