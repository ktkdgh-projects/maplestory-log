<script setup lang="ts">
import type { NavItem } from '~/utils/nav'

const route = useRoute()
const { me, refresh } = await useMe()

const activeGroup = computed(() => navGroupOf(route.path))
const sundayBadge = useSundayBadge()

// 캐릭터를 보던 중이면 성장 기록도 그 캐릭터로 연다
function linkOf(item: NavItem) {
  const name = route.query.name
  return item.to === '/growth' && typeof name === 'string' && name ? { path: '/growth', query: { name } } : item.to
}

const profileOpen = ref(false)
const profile = ref<HTMLElement>()
function closeProfile(event: Event) {
  if (profileOpen.value && !profile.value?.contains(event.target as Node)) profileOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', closeProfile))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeProfile))
// 메뉴로 옮겨 가면 메뉴를 닫고, 누른 링크에 남은 포커스도 풀어 드롭다운이 다시 뜨지 않게 한다
watch(() => route.fullPath, () => {
  profileOpen.value = false
  if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.menubar')) document.activeElement.blur()
})

async function logout() {
  profileOpen.value = false
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refresh()
  await navigateTo('/')
}
</script>

<template>
  <header class="menubar">
    <div class="bar">
      <NuxtLink to="/" class="logo">
        <img src="/favicon.svg" alt="" width="28" height="28">
        <span>메이플스토리로그</span>
      </NuxtLink>
      <nav class="groups" aria-label="메뉴">
        <div v-for="group in NAV_GROUPS" :key="group.key" class="group" :class="{ on: activeGroup?.key === group.key }">
          <NuxtLink :to="linkOf(group.items[0]!)" class="group-link">
            {{ group.label }}
            <!-- 발표 전엔 꺼진 등, 발표되면 켜진 등. 아직 안 봤으면 깜빡인다 -->
            <template v-if="group.key === 'sunday'">
              <span v-if="sundayBadge.kind === 'waiting'" class="lamp" aria-label="발표 전" />
              <span v-else-if="sundayBadge.kind === 'new'" class="lamp on blink" aria-label="이번 주 썬데이 발표됨" />
              <span v-else-if="sundayBadge.kind === 'upcoming'" class="chip soon"><i class="lamp on" />D-{{ sundayBadge.days }}</span>
              <span v-else-if="sundayBadge.kind === 'today'" class="chip live"><i class="lamp on today" />오늘</span>
            </template>
            <span v-else-if="group.isNew" class="new">NEW</span>
          </NuxtLink>
          <div v-if="group.items.length > 1" class="drop">
            <NuxtLink v-for="item in group.items" :key="item.to" :to="linkOf(item)" class="drop-item">
              {{ item.label }}<small>{{ item.hint }}</small>
            </NuxtLink>
          </div>
        </div>
      </nav>
      <div class="right">
        <HeaderSearch />
        <div v-if="me" ref="profile" class="profile">
          <button type="button" class="me" :aria-expanded="profileOpen" aria-haspopup="menu" @click="profileOpen = !profileOpen">
            <span class="face" :class="{ broken: me.keyStatus === 'invalid' || me.keyStatus === 'deleted' }">
              <img v-if="me.main?.imageUrl" :src="me.main.imageUrl" alt="">
            </span>
            <span class="me-name">{{ me.main?.name ?? '내 정보' }}</span>
            <span class="caret" aria-hidden="true">▾</span>
          </button>
          <Transition name="pop">
            <div v-if="profileOpen" class="menu" role="menu">
              <NuxtLink to="/me" class="drop-item" role="menuitem">내 정보<small>대표 캐릭터·API 키</small></NuxtLink>
              <NuxtLink v-if="me.isAdmin" to="/admin" class="drop-item" role="menuitem">운영<small>수집 상태·사용자</small></NuxtLink>
              <button type="button" class="drop-item" role="menuitem" @click="logout">로그아웃</button>
            </div>
          </Transition>
        </div>
        <NuxtLink v-else to="/login" class="key-btn"><svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l3 3M14 9l2 2" /></svg>키 등록</NuxtLink>
      </div>
    </div>
    <div v-if="activeGroup && activeGroup.items.length > 1" class="subbar">
      <nav class="sub-in" :aria-label="`${activeGroup.label} 메뉴`">
        <span class="crumb">{{ activeGroup.label }}</span>
        <NuxtLink v-for="item in activeGroup.items" :key="item.to" :to="linkOf(item)" class="sub-link" :class="{ on: isNavItemActive(item, route.path) }">
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.menubar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(90deg, rgb(14 17 28 / 0.92), rgb(35 30 60 / 0.92));
  border-bottom: 1px solid var(--win-line);
  backdrop-filter: blur(10px);
}
.bar {
  display: flex;
  align-items: center;
  gap: 28px;
  max-width: var(--page-width);
  height: 56px;
  margin: 0 auto;
  padding: 0 20px;
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(90deg, #ffb347, var(--gold));
  background-clip: text;
  color: transparent;
  font-family: var(--f-title);
  font-size: 23px;
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
.groups {
  display: flex;
  align-self: stretch;
  gap: 4px;
}
.group {
  position: relative;
  display: flex;
}
.group-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 14px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 18px;
  text-decoration: none;
  transition: color var(--fast) ease;
}
.group-link:hover,
.group:has(:focus-visible) .group-link {
  color: var(--text);
}
.group.on .group-link {
  color: var(--text);
}
/* 지금 묶음은 금색 밑줄 하나로만 표시한다 */
.group.on .group-link::after {
  content: "";
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 3px;
  background: var(--gold);
  border-radius: 3px 3px 0 0;
  box-shadow: 0 0 10px rgb(242 193 78 / 0.6);
}
/* 썬데이 등: 발표 전엔 꺼진 회색, 발표되면 금색으로 켜지고 안 봤으면 깜빡인다 */
.lamp {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #3a4366;
  border: 1px solid var(--tip-line);
  border-radius: 50%;
  transition: background var(--normal) ease, box-shadow var(--normal) ease;
}
.lamp.on {
  background: var(--gold);
  border-color: #ffe7a3;
  box-shadow: 0 0 8px var(--gold), 0 0 2px #fff inset;
}
.lamp.on.today {
  background: var(--gain);
  border-color: #c9f5d6;
  box-shadow: 0 0 8px var(--gain);
}
.lamp.blink {
  animation: blink 1.6s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.4; }
}
/* 봤고 일요일 전이면 켜진 등 + D-n, 일요일엔 '오늘' */
/* 제목 글꼴은 글자가 줄 위쪽에 붙어 보여서 배지를 그만큼 올린다 */
.lamp,
.chip,
.new {
  position: relative;
  top: -2px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 4px;
  border: 1px solid;
  border-radius: 999px;
  font: 800 10px/1 var(--f-body);
}
.chip .lamp {
  width: 6px;
  height: 6px;
}
.chip.soon {
  color: var(--gold);
}
.chip.live {
  background: rgb(127 217 154 / 0.15);
  color: var(--gain);
}
.new {
  padding: 3px 4px;
  background: var(--gold);
  border-radius: 4px;
  color: var(--on-gold);
  font: 800 9px/1 var(--f-body);
}
.drop,
.menu {
  position: absolute;
  top: calc(100% - 4px);
  left: 4px;
  z-index: 20;
  display: grid;
  gap: 2px;
  min-width: 200px;
  padding: 6px;
  background: rgb(14 17 32 / 0.98);
  border: 1px solid var(--tip-line);
  border-radius: 10px;
  box-shadow: 0 14px 30px rgb(0 0 0 / 0.5);
}
.drop {
  opacity: 0;
  pointer-events: none;
  translate: 0 -4px;
  transition: opacity var(--fast) ease, translate var(--fast) var(--ease-out);
}
/* 마우스로 누른 링크엔 포커스가 남아서 focus-within으로 열면 안 닫히고 두 개가 겹쳐 뜬다. 키보드 포커스일 때만 연다 */
.group:hover .drop,
.group:has(:focus-visible) .drop {
  opacity: 1;
  pointer-events: auto;
  translate: 0 0;
}
.groups:has(.group:hover) .group:not(:hover) .drop {
  opacity: 0;
  pointer-events: none;
}
.drop-item {
  display: grid;
  padding: 7px 10px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.drop-item small {
  color: var(--sub);
  font-size: 12px;
}
.drop-item:hover,
.drop-item:focus-visible,
.drop-item.router-link-exact-active {
  background: var(--panel);
}
.drop-item.router-link-exact-active {
  color: var(--gold);
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}
.profile {
  position: relative;
}
.menu {
  right: 0;
  left: auto;
  top: calc(100% + 8px);
}
.key-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px 0 11px;
  background: rgb(242 193 78 / 0.1);
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  white-space: nowrap;
  text-decoration: none;
  transition: background var(--fast) ease, box-shadow var(--fast) ease;
}
.key-btn:hover {
  background: rgb(242 193 78 / 0.2);
  box-shadow: 0 0 12px rgb(242 193 78 / 0.3);
}
.me {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px 0 3px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.me:hover,
.me[aria-expanded="true"] {
  border-color: var(--tip-line);
}
.face {
  position: relative;
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--tip-line);
  border-radius: 50%;
}
.face img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
  scale: 2.2;
}
/* 키가 무효면 얼굴 옆에 빨간 점 */
.face.broken::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  background: var(--loss);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--bar);
}
.caret {
  color: var(--sub);
  font-size: 11px;
}
.subbar {
  background: rgb(26 31 51 / 0.85);
  border-top: 1px solid var(--panel-line);
}
.sub-in {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: var(--page-width);
  height: 40px;
  margin: 0 auto;
  padding: 0 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.crumb {
  margin-right: 10px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 15px;
  white-space: nowrap;
}
.sub-link {
  padding: 4px 12px;
  border-radius: 999px;
  color: var(--sub);
  font-size: 14px;
  white-space: nowrap;
  text-decoration: none;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.sub-link:hover {
  color: var(--text);
}
.sub-link.on {
  background: rgb(242 193 78 / 0.14);
  box-shadow: inset 0 0 0 1px rgb(242 193 78 / 0.4);
  color: var(--gold);
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity var(--fast) ease, translate var(--fast) var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  translate: 0 -4px;
}
@media (max-width: 860px) {
  .me-name {
    display: none;
  }
}
/* 휴대폰에서는 묶음 메뉴를 아래 탭바로 옮긴다 */
@media (max-width: 640px) {
  .bar {
    gap: 10px;
    height: 52px;
    padding: 0 14px;
  }
  .groups {
    display: none;
  }
  .logo {
    font-size: 19px;
  }
  .right {
    gap: 8px;
  }
  .sub-in {
    padding: 0 14px;
  }
}
</style>
