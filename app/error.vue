<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: '알림 · 메이플스토리로그' })
</script>

<template>
  <NuxtLayout>
    <GameWindow title="알림" :sub="String(error.statusCode)">
      <p class="muted">{{ notFound ? '찾는 페이지가 없어요.' : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }}</p>
      <div><button class="btn" @click="clearError({ redirect: '/' })">처음으로</button></div>
    </GameWindow>
  </NuxtLayout>
</template>
