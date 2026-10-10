<script setup lang="ts">
const { me } = await useMe()
if (me.value) await navigateTo(me.value.main ? '/' : '/me')

// 처음 등록해 대표 캐릭터를 골랐으면 성장 기록부터 보여 준다
const done = (pickedMain: boolean) => navigateTo(pickedMain ? '/growth' : '/')

useHead({ title: 'API 키 등록 · 메이플스토리로그' })
</script>

<template>
  <GameWindow title="API 키 등록" sub="넥슨 로그인이 아니에요">
    <div class="npc">
      <img src="/favicon.svg" alt="" class="face">
      <p class="say">
        넥슨 Open API 사이트에서 직접 발급한 키를 넣어 주세요. 키는 암호화해서 보관하고, 화면에는 끝 네 자리만 보여 드려요.
      </p>
    </div>
    <div class="form">
      <KeyLogin @done="done" />
    </div>
    <p class="muted small">이 사이트는 넥슨 계정 비밀번호를 묻지 않아요.</p>
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
.small {
  font-size: 13px;
}
.form {
  max-width: 560px;
}
</style>
