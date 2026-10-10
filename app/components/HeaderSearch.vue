<script setup lang="ts">
const route = useRoute()
const input = ref(typeof route.query.name === 'string' ? route.query.name : '')
const field = ref<HTMLInputElement>()
// 휴대폰에서는 아이콘만 두고 누르면 헤더 위로 펼친다
const open = ref(false)

watch(() => route.query.name, (name) => {
  input.value = typeof name === 'string' ? name : ''
})

function search() {
  const name = input.value.trim()
  if (!name) return
  field.value?.blur()
  open.value = false
  // 성장 페이지에서 검색하면 그 캐릭터의 성장 기록을, 나머지는 캐릭터 정보를 연다
  navigateTo({ path: route.path === '/growth' ? '/growth' : '/', query: { name } })
}

async function expand() {
  open.value = true
  await nextTick()
  field.value?.focus()
}

// 입력칸 밖에서 / 를 누르면 검색칸으로 간다
function onKey(event: KeyboardEvent) {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return
  event.preventDefault()
  expand()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <form class="search" :class="{ open }" role="search" @submit.prevent="search">
    <label for="header-search" class="sr-only">캐릭터 이름</label>
    <span class="icon" aria-hidden="true">⌕</span>
    <input id="header-search" ref="field" v-model="input" placeholder="캐릭터 검색" maxlength="20" autocomplete="off" enterkeyhint="search" @blur="open = false">
    <kbd aria-hidden="true">/</kbd>
  </form>
  <button type="button" class="search-toggle" aria-label="캐릭터 검색" @click="expand">⌕</button>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  width: 210px;
  height: 36px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  transition: width var(--normal) var(--ease-out), border-color var(--fast) ease, background var(--fast) ease;
}
.search:focus-within {
  width: 280px;
  background: var(--panel);
  border-color: var(--gold);
}
.icon {
  padding: 0 4px 0 12px;
  color: var(--sub);
  font-size: 18px;
  pointer-events: none;
}
input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 4px;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 14px;
}
input::placeholder {
  color: var(--sub);
}
kbd {
  margin-right: 8px;
  padding: 2px 6px;
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  color: var(--sub);
  font: 11px/1.2 var(--f-body);
}
.search:focus-within kbd {
  display: none;
}
.search-toggle {
  display: none;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  color: var(--sub);
  font-size: 18px;
  cursor: pointer;
}
@media (max-width: 640px) {
  .search {
    position: absolute;
    top: 8px;
    right: 14px;
    left: 14px;
    z-index: 5;
    width: auto;
    background: var(--panel);
    opacity: 0;
    pointer-events: none;
  }
  .search.open,
  .search:focus-within {
    width: auto;
    opacity: 1;
    pointer-events: auto;
  }
  kbd {
    display: none;
  }
  .search-toggle {
    display: grid;
  }
}
</style>
