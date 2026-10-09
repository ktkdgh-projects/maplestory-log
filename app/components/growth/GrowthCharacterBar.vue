<script setup lang="ts">
import type { CharacterBrief, TrackedCharacter } from '#shared/types'

const props = defineProps<{ tracked: TrackedCharacter[], max: number }>()
const selected = defineModel<string>({ required: true })
const emit = defineEmits<{ changed: [] }>()

const adding = ref(false)
const busy = ref(false)
const failure = ref('')
const candidates = ref<CharacterBrief[] | null>(null)

async function openPicker() {
  adding.value = true
  failure.value = ''
  candidates.value ??= await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
    failure.value = errorMessage(error)
    return null
  })
}

async function run(action: () => Promise<unknown>) {
  busy.value = true
  failure.value = ''
  try {
    await action()
    emit('changed')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

const add = (ocid: string) => run(async () => {
  await $fetch('/api/growth/characters', { method: 'POST', body: { ocid } })
  adding.value = false
  selected.value = ocid
})

const remove = (ocid: string) => run(async () => {
  await $fetch(`/api/growth/characters/${ocid}`, { method: 'DELETE' })
  if (selected.value === ocid) selected.value = props.tracked.find(t => t.isMain)?.ocid ?? ''
})
</script>

<template>
  <div class="bar">
    <div class="chips" role="group" aria-label="성장 기록 캐릭터">
      <div v-for="c in tracked" :key="c.ocid" class="chip" :class="{ active: c.ocid === selected }">
        <button type="button" class="pick" @click="selected = c.ocid">
          <CharacterThumb v-if="c.imageUrl" :src="c.imageUrl" :height="40" crop="head" class="face" />
          <span class="name">{{ c.name }}</span>
          <small>LV.{{ c.level }}</small>
          <span v-if="c.isMain" class="main">대표</span>
        </button>
        <button v-if="!c.isMain" type="button" class="remove" :disabled="busy" :aria-label="`${c.name} 빼기`" @click="remove(c.ocid)">×</button>
      </div>
      <button v-if="tracked.length < max" type="button" class="add" @click="adding ? (adding = false) : openPicker()">
        {{ adding ? '닫기' : `+ 캐릭터 추가 (${tracked.length}/${max})` }}
      </button>
    </div>
    <p v-if="failure" class="form-error">{{ failure }}</p>
    <Transition name="fade">
      <div v-if="adding" class="picker">
        <p v-if="!candidates" class="muted">캐릭터 목록을 불러오는 중이에요…</p>
        <CharacterPicker
          v-else
          :characters="candidates.filter(c => !tracked.some(t => t.ocid === c.ocid))"
          :busy="busy"
          @pick="add"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bar {
  display: grid;
  gap: 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  transition: border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.chip.active {
  border-color: var(--gold);
  box-shadow: var(--glow);
}
.pick {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 0;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.face {
  width: 44px;
}
.name {
  font-family: var(--f-title);
  font-size: 15px;
}
small {
  color: var(--sub);
  font-size: 12px;
}
.main {
  padding: 0 6px;
  background: var(--gold);
  border-radius: 999px;
  color: var(--on-gold);
  font-size: 11px;
}
.remove {
  padding: 0 10px;
  background: none;
  border: 0;
  border-left: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 16px;
  cursor: pointer;
}
.remove:hover {
  color: var(--loss);
}
.add {
  padding: 0 14px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.add:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.picker {
  padding: 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
</style>
