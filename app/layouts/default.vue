<script setup lang="ts">
const { me } = await useMe()

const keyBroken = computed(() => me.value?.keyStatus === 'invalid' || me.value?.keyStatus === 'deleted')
// 메모장은 따로 페이지 없이, 가계부 페이지에 떠 있는 버튼으로만 연다
const route = useRoute()
const memoFab = computed(() => !!me.value && navGroupOf(route.path)?.key === 'ledger')
</script>

<template>
  <div class="layout">
    <AppBackground />
    <AppHeader />

    <Transition name="fade">
      <div v-if="keyBroken" class="banner" role="alert">
        키가 더 이상 작동하지 않아요. <NuxtLink to="/me">새 키를 등록</NuxtLink>하면 기록이 이어져요.
      </div>
    </Transition>

    <main class="wrap">
      <slot />
    </main>

    <footer class="footer">
      <span class="credit"><span>Data based on NEXON Open API</span> <span>· 넥슨의 공식 서비스가 아닙니다</span></span>
      <nav aria-label="안내">
        <NuxtLink to="/guide/api-key">키 발급 안내</NuxtLink>
        <NuxtLink to="/terms">이용약관</NuxtLink>
        <NuxtLink to="/privacy">개인정보처리방침</NuxtLink>
      </nav>
    </footer>
    <AppTabbar />
    <ClientOnly><MemoFab v-if="memoFab" /></ClientOnly>
    <ClientOnly><ConfirmHost /></ClientOnly>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.banner {
  padding: 10px 16px;
  background: color-mix(in srgb, var(--loss) 8%, transparent);
  border-bottom: 1px solid var(--loss);
  color: var(--loss);
  text-align: center;
  font-size: 15px;
}
.banner a {
  color: var(--gold);
}
.wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--page-width);
  flex: 1;
  margin: 0 auto;
  padding: 18px 20px 28px;
}
.footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 20px;
  padding: 10px 16px;
  border-top: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 13px;
  text-align: center;
}
/* 좁으면 출처와 안내를 덩어리째 줄바꿈해 글자가 중간에서 꺾이지 않게 한다 */
.credit span {
  display: inline-block;
}
.footer nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 14px;
}
.footer a {
  color: var(--sub);
  text-decoration: none;
  transition: color var(--fast) ease;
}
.footer a:hover {
  color: var(--gold);
}
/* 넓은 화면은 한 화면에 들어오게: 본문이 남은 높이를 채우고 페이지(.fit)가 그 안에서 나눠 쓴다 */
@media (min-width: 1100px) and (min-height: 700px) {
  .layout {
    height: 100dvh;
  }
  .wrap {
    min-height: 0;
    overflow: auto;
    scrollbar-gutter: stable;
    padding-bottom: 16px;
  }
  /* 한 화면에 맞추는 페이지(.fit)가 아니면 창이 화면 높이에 맞춰 줄어들며 잘리지 않고, 본문이 스크롤된다 */
  .wrap > :not(.fit) {
    flex-shrink: 0;
  }
}
/* 하단 탭바에 가리지 않게 아래를 비운다 */
@media (max-width: 640px) {
  .layout {
    padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px));
  }
  .wrap {
    padding: 14px 16px 24px;
  }
}
</style>
