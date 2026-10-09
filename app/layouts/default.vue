<!-- 공통 레이아웃: 상단 메뉴 바 + 본문 + 출처 표기 -->
<template>
  <div class="layout">
    <header class="menubar">
      <NuxtLink to="/" class="logo">MAPLE LOG</NuxtLink>
      <nav class="menu" aria-label="메뉴">
        <NuxtLink to="/">캐릭터</NuxtLink>
        <NuxtLink to="/growth">성장</NuxtLink>
        <NuxtLink to="/me">내 정보</NuxtLink>
      </nav>
    </header>
    <main class="wrap">
      <slot />
    </main>
    <footer class="footer">
      Data based on NEXON Open API ·
      <NuxtLink to="/terms">이용약관</NuxtLink> ·
      <NuxtLink to="/privacy">개인정보처리방침</NuxtLink>
    </footer>
  </div>
</template>

<style scoped>
.menubar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  padding: 8px 16px;
  background: var(--bar);
  border-bottom: 2px solid var(--win-line);
}
.logo {
  margin-right: auto;
  font-family: var(--f-pixel);
  font-size: 18px;
  color: var(--gold);
  text-decoration: none;
}
.menu {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.menu a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  font-family: var(--f-title);
  font-size: 16px;
  text-decoration: none;
}
.menu a.router-link-exact-active {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}
.footer {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--sub);
}
.footer a {
  color: var(--sub);
}
</style>
