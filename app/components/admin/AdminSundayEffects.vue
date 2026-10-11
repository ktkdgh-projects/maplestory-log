<script setup lang="ts">
import type { SundayResponse } from '#shared/types'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

// 여기서 체크해 둔 효과를 스타포스 계산기가 자동으로 켠다
const { data, refresh } = await useFetch<SundayResponse>('/api/sunday', { server: false, lazy: true })
const notice = computed(() => data.value?.current ?? data.value?.history[0] ?? null)
const picked = ref<string[]>([])
watch(notice, (n) => {
  picked.value = [...(n?.effects ?? [])]
}, { immediate: true })

const busy = ref(false)
const failure = ref('')
const saved = computed(() => JSON.stringify([...picked.value].sort()) === JSON.stringify([...(notice.value?.effects ?? [])].sort()) && notice.value?.effects !== null)

async function save() {
  if (!notice.value) return
  busy.value = true
  failure.value = ''
  try {
    await $fetch('/api/admin/sunday-effects', { method: 'PUT', body: { id: notice.value.id, effects: picked.value } })
    await refresh()
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

const dayText = (iso: string) => {
  const date = kstDateOf(iso)
  return `${formatMonthDay(date)} (${WEEKDAYS[kstWeekday(date)]})`
}
</script>

<template>
  <section class="sunday">
    <template v-if="notice">
      <img v-if="notice.image" :src="notice.image" alt="" class="thumb">
      <div class="body">
        <div class="head">
          <b>{{ dayText(notice.start) }} 썬데이 스타포스 효과</b>
          <span class="state" :class="{ todo: notice.effects === null }">{{ notice.effects === null ? '아직 안 골랐어요' : notice.effects.length ? '계산기에 적용 중' : '스타포스 효과 없음으로 저장됨' }}</span>
          <a :href="notice.url" target="_blank" rel="noopener" class="origin">공지 보기 →</a>
        </div>
        <div class="effects">
          <label v-for="e in SUNDAY_STARFORCE_EFFECTS" :key="e.key" class="effect">
            <input v-model="picked" type="checkbox" :value="e.key">
            <span>{{ e.label }}</span>
          </label>
        </div>
        <div class="foot">
          <small class="muted">아무것도 안 고르고 저장하면 "스타포스 효과 없는 주"로 남아요.</small>
          <button type="button" class="btn compact" :disabled="busy || saved" @click="save">{{ saved ? '저장됨' : '저장' }}</button>
        </div>
        <p v-if="failure" class="form-error">{{ failure }}</p>
      </div>
    </template>
    <p v-else class="muted">아직 모은 썬데이 공지가 없어요.</p>
  </section>
</template>

<style scoped>
.sunday {
  display: flex;
  gap: 14px;
  padding: 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.thumb {
  flex: none;
  width: 96px;
  height: 96px;
  object-fit: cover;
  object-position: top;
  border-radius: 8px;
}
.body {
  display: grid;
  flex: 1;
  gap: 8px;
  min-width: 0;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.head b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.state {
  padding: 1px 8px;
  border: 1px solid rgb(127 217 154 / 0.5);
  border-radius: 999px;
  color: var(--gain);
  font-size: 12px;
}
.state.todo {
  border-color: rgb(242 193 78 / 0.5);
  color: var(--gold);
}
.origin {
  margin-left: auto;
  color: var(--api);
  font-size: 13px;
  text-decoration: none;
}
.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.effect {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}
.effect:has(input:checked) {
  background: rgb(242 193 78 / 0.12);
  border-color: var(--gold);
  color: var(--gold);
}
.effect input {
  accent-color: var(--gold);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
</style>
