<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'

const { me, refresh } = await useMe()
if (me.value) await navigateTo(me.value.main ? '/' : '/me')

const apiKey = ref('')
const agree = ref(false)
const remember = ref(true)
const busy = ref(false)
const failure = ref('')
const characters = ref<CharacterBrief[] | null>(null)

async function login() {
  failure.value = ''
  busy.value = true
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { apiKey: apiKey.value, agree: agree.value, remember: remember.value },
    })
    apiKey.value = ''
    await refresh()
    if (result.needsMain) characters.value = result.characters
    else await navigateTo('/')
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
    await navigateTo('/growth')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

useHead({ title: 'API 키 등록 · 메이플스토리로그' })
</script>

<template>
  <GameWindow v-if="!characters" title="API 키 등록" sub="넥슨 로그인이 아니에요">
    <div class="npc">
      <img src="/favicon.svg" alt="" class="face">
      <p class="say">
        넥슨 Open API 사이트에서 직접 발급한 키를 넣어 줘. 키는 암호화해서 보관하고, 화면에는 끝 네 자리만 보여줄게.
      </p>
    </div>

    <form class="form" @submit.prevent="login">
      <label for="api-key">API 키</label>
      <input id="api-key" v-model="apiKey" class="field-input" type="password" autocomplete="off" required placeholder="live_… 또는 test_…">

      <label class="check">
        <input v-model="agree" type="checkbox" required>
        키 보관과 매일 자동 수집에 동의합니다 (내 정보에서 언제든 삭제할 수 있어요)
      </label>
      <label class="check">
        <input v-model="remember" type="checkbox">
        이 기기에서 로그인 유지 <span class="muted">(공용 PC라면 꺼 주세요)</span>
      </label>

      <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
      <button type="submit" class="btn" :disabled="busy">{{ busy ? '확인 중…' : '키 등록하기' }}</button>
    </form>

    <p class="muted small">
      키가 없다면 <NuxtLink to="/guide/api-key">키 발급 방법</NuxtLink>을 먼저 확인해 주세요.
      이 사이트는 넥슨 계정 비밀번호를 묻지 않아요.
    </p>
  </GameWindow>

  <GameWindow v-else title="대표 캐릭터 고르기" :sub="`${characters.length}명`">
    <p class="muted">매일 성장 기록을 모을 캐릭터를 골라 주세요. 내 정보에서 언제든 바꿀 수 있어요.</p>
    <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
    <CharacterPicker :characters="characters" :busy="busy" @pick="pickMain" />
  </GameWindow>
</template>

<style scoped>
.npc {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.face {
  flex: none;
  width: 56px;
  height: 56px;
  padding: 6px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 8px;
  animation: bob 2.4s ease-in-out infinite;
}
.say {
  position: relative;
  margin: 0;
  padding: 10px 14px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  font-size: 14px;
  animation: rise-in 0.5s var(--ease-out) 0.15s backwards;
}
.say::before {
  content: "";
  position: absolute;
  top: 18px;
  left: -8px;
  width: 12px;
  height: 12px;
  background: var(--bar);
  border-left: 2px solid var(--tip-line);
  border-bottom: 2px solid var(--tip-line);
  transform: rotate(45deg);
}
.form {
  display: grid;
  gap: 10px;
  max-width: 560px;
}
.form > label:first-child {
  color: var(--sub);
  font-size: 13px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 14px;
}
.check input {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 3px;
}
.form .btn {
  justify-self: start;
}
.small {
  font-size: 13px;
}
.small a {
  color: var(--api);
}
</style>
