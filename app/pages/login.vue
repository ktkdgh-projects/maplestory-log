<script setup lang="ts">
const { me } = await useMe()
if (me.value) await navigateTo(me.value.main ? '/' : '/me')

// 처음 등록해 대표 캐릭터를 골랐으면 성장 기록부터 보여 준다
const done = (pickedMain: boolean) => navigateTo(pickedMain ? '/growth' : '/')

useHead({ title: 'API 키 등록 · 메이플스토리로그' })
</script>

<template>
  <GameWindow title="API 키 등록" sub="넥슨 Open API 키">
    <NpcSay>
      넥슨 비밀번호가 아니라, Open API 사이트에서 직접 발급한 <b>키</b>를 넣어 주세요. 키는 암호화해서 보관하고 화면에는 끝 네 자리만 보여 드려요.
    </NpcSay>
    <div class="form">
      <KeyLogin @done="done" />
    </div>
  </GameWindow>
</template>

<style scoped>
.form {
  max-width: 560px;
}
</style>
