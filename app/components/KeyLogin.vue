<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'

// API 키 등록 칸. 로그인 페이지와 키가 필요한 페이지(로그아웃 상태)에서 같이 쓴다
// 처음 온 사람은 등록 뒤 같은 자리에서 대표 캐릭터까지 고른다
const emit = defineEmits<{ done: [pickedMain: boolean] }>()
const { refresh } = await useMe()

const apiKey = ref('')
const agree = ref(false)
const remember = ref(true)
const busy = ref(false)
const failure = ref('')
const characters = ref<CharacterBrief[] | null>(null)
const keyInput = ref<HTMLInputElement | null>(null)

async function login() {
  // 브라우저 기본 말풍선 대신 아래 안내 줄로 알려 준다
  if (!apiKey.value.trim()) {
    failure.value = 'API 키를 붙여넣어 주세요.'
    keyInput.value?.focus()
    return
  }
  if (!agree.value) {
    failure.value = '키 보관과 자동 수집에 동의해야 등록할 수 있어요.'
    return
  }
  failure.value = ''
  busy.value = true
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { apiKey: apiKey.value.trim(), agree: agree.value, remember: remember.value },
    })
    apiKey.value = ''
    await refresh()
    if (result.needsMain) characters.value = result.characters
    else emit('done', false)
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

async function pickMain(ocid: string) {
  failure.value = ''
  busy.value = true
  try {
    await $fetch('/api/me/main', { method: 'PUT', body: { ocid } })
    await refresh()
    emit('done', true)
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form v-if="!characters" class="key-form" novalidate @submit.prevent="login">
    <label for="api-key" class="label">API 키</label>
    <input
      id="api-key"
      ref="keyInput"
      v-model="apiKey"
      class="field-input"
      type="password"
      autocomplete="off"
      placeholder="live_… 또는 test_…"
      @input="failure = ''"
    >

    <label class="check">
      <input v-model="agree" type="checkbox" @change="failure = ''">
      <span>키 보관과 매일 자동 수집에 동의합니다 <span class="muted">(내 정보에서 언제든 삭제할 수 있어요)</span></span>
    </label>
    <label class="check">
      <input v-model="remember" type="checkbox">
      <span>이 기기에서 로그인 유지 <span class="muted">(공용 PC라면 꺼 주세요)</span></span>
    </label>

    <!-- 안내 줄은 늘 자리를 잡아 둬서 떠도 버튼이 밀리지 않는다 -->
    <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
    <div class="row">
      <button type="submit" class="btn" :disabled="busy"><template v-if="!busy"><svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l3 3M14 9l2 2" /></svg></template>{{ busy ? '확인 중…' : '키 등록하기' }}</button>
      <NuxtLink to="/guide/api-key" class="guide">키가 없나요? 발급 방법 보기 →</NuxtLink>
    </div>
  </form>

  <div v-else class="pick">
    <p class="muted">등록했어요! 매일 성장 기록을 모을 <b>대표 캐릭터</b>를 골라 주세요. 내 정보에서 언제든 바꿀 수 있어요.</p>
    <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
    <CharacterPicker :characters="characters" :busy="busy" @pick="pickMain" />
  </div>
</template>

<style scoped>
.key-form {
  display: grid;
  gap: 10px;
}
.label {
  color: var(--sub);
  font-size: 13px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 14px;
  cursor: pointer;
}
.check input {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: var(--gold);
}
.hint {
  height: 20px;
  margin: 0;
  overflow: hidden;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--loss);
  font-size: 13px;
  opacity: 0;
  transition: opacity var(--fast) ease;
}
.hint.show {
  opacity: 1;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.guide {
  color: var(--api);
  font-size: 13px;
  text-decoration: none;
}
.guide:hover {
  text-decoration: underline;
}
.pick {
  display: grid;
  gap: 10px;
}
.pick b {
  color: var(--gold);
}
</style>
