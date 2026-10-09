<script setup lang="ts">
const route = useRoute()
const { me, refresh } = await useMe()

const keyBroken = computed(() => me.value?.keyStatus === 'invalid' || me.value?.keyStatus === 'deleted')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refresh()
  await navigateTo('/')
}
</script>

<template>
  <div class="layout">
    <AppBackground />
    <header class="menubar">
      <div class="menubar-in">
        <NuxtLink to="/" class="logo">
          <img src="/favicon.svg" alt="" width="30" height="30">
          <span>메이플스토리로그</span>
        </NuxtLink>
        <HeaderSearch />
        <nav class="menu" aria-label="메뉴">
          <MenuButton to="/" :active="route.path === '/'">캐릭터</MenuButton>
          <MenuButton to="/growth">성장</MenuButton>
          <template v-if="me">
            <MenuButton to="/me">내 정보</MenuButton>
            <MenuButton @click="logout">로그아웃</MenuButton>
          </template>
          <MenuButton v-else to="/login">키 등록</MenuButton>
        </nav>
      </div>
    </header>

    <Transition name="fade">
      <div v-if="keyBroken" class="banner" role="alert">
        키가 더 이상 작동하지 않아요. <NuxtLink to="/me">새 키를 등록</NuxtLink>하면 기록이 이어져요.
      </div>
    </Transition>

    <main class="wrap">
      <slot />
    </main>

    <footer class="footer">
      <span>Data based on NEXON Open API · 넥슨의 공식 서비스가 아닙니다</span>
      <nav aria-label="안내">
        <NuxtLink to="/guide/api-key">키 발급 안내</NuxtLink>
        <NuxtLink to="/terms">이용약관</NuxtLink>
        <NuxtLink to="/privacy">개인정보처리방침</NuxtLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.menubar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(90deg, rgb(14 17 28 / 0.9), rgb(35 30 60 / 0.9));
  border-bottom: 2px solid var(--win-line);
  backdrop-filter: blur(10px);
}
.menubar-in {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 8px 20px;
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(90deg, #ffb347, var(--gold));
  background-clip: text;
  color: transparent;
  font-family: var(--f-title);
  font-size: 25px;
  text-decoration: none;
  white-space: nowrap;
}
.logo img {
  transform-origin: 50% 90%;
  transition: transform var(--normal) var(--ease-spring);
  animation: sway 4s ease-in-out infinite;
}
.logo:hover img {
  transform: rotate(-18deg) scale(1.15);
}
@keyframes sway {
  50% { rotate: 8deg; }
}
.menu {
  display: flex;
  gap: 6px;
  margin-left: auto;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.banner {
  padding: 10px 16px;
  background: rgb(255 138 122 / 0.08);
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
    padding-bottom: 16px;
  }
}
@media (max-width: 520px) {
  .logo {
    font-size: 21px;
  }
  .menu {
    width: 100%;
    margin-left: 0;
  }
  .menu > * {
    flex: 1;
    padding: 0 8px;
  }
}
</style>
