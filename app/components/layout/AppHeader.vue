<script setup lang="ts">
import type { NavItem } from '~/utils/nav'
import { navLinkOf, sundayBadgeLabel } from '~/utils/nav'

const route = useRoute()
const { me, refresh } = await useMe()
const { flush: flushMemos, forget: forgetMemos } = useMemos()

const activeGroup = computed(() => navGroupOf(route.path))
const sundayBadge = useSundayBadge()

const linkOf = (item: NavItem) => navLinkOf(item, route.query)

// 마우스는 올리면 열리고, 터치·클릭은 옆 화살표를 눌러 연다
const openGroup = ref<string | null>(null)
const groupsEl = ref<HTMLElement>()

const profileOpen = ref(false)
const profile = ref<HTMLElement>()
function onOutside(event: Event) {
  if (profileOpen.value && !profile.value?.contains(event.target as Node)) profileOpen.value = false
  if (openGroup.value && !groupsEl.value?.contains(event.target as Node)) openGroup.value = null
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    openGroup.value = null
    profileOpen.value = false
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKey)
})
// 메뉴로 옮겨 가면 메뉴를 닫고, 누른 링크에 남은 포커스도 풀어 드롭다운이 다시 뜨지 않게 한다
watch(() => route.fullPath, () => {
  profileOpen.value = false
  openGroup.value = null
  if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.menubar')) document.activeElement.blur()
})

const logoutFailed = ref(false)
async function logout() {
  logoutFailed.value = false
  try {
    await flushMemos()
    await $fetch('/api/auth/logout', { method: 'POST' })
  }
  catch {
    // 메뉴를 닫지 않고 같은 자리에서 다시 누를 수 있게 둔다
    logoutFailed.value = true
    return
  }
  forgetMemos()
  profileOpen.value = false
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
      <nav ref="groupsEl" class="groups" aria-label="메뉴">
        <div v-for="group in NAV_GROUPS" :key="group.key" class="group" :class="{ on: activeGroup?.key === group.key, open: openGroup === group.key }">
          <NuxtLink :to="linkOf(group.items[0]!)" class="group-link">
            {{ group.label }}
            <template v-if="group.key === 'sunday'">
              <span v-if="sundayBadge.kind === 'waiting'" class="lamp" />
              <span v-else-if="sundayBadge.kind === 'new'" class="lamp on blink" />
              <span v-else-if="sundayBadge.kind === 'upcoming'" class="chip soon"><i class="lamp on" />D-{{ sundayBadge.days }}</span>
              <span v-else-if="sundayBadge.kind === 'today'" class="chip live"><i class="lamp on today" />오늘</span>
            </template>
            <span v-else-if="group.isNew" class="new">NEW</span>
            <span v-if="group.key === 'sunday'" class="sr-only">{{ sundayBadgeLabel(sundayBadge) }}</span>
          </NuxtLink>
          <button
            v-if="group.items.length > 1"
            type="button"
            class="group-toggle"
            :aria-expanded="openGroup === group.key"
            :aria-label="`${group.label} 메뉴 펼치기`"
            @click="openGroup = openGroup === group.key ? null : group.key"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
          </button>
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
              <button type="button" class="drop-item" :class="{ failed: logoutFailed }" role="menuitem" @click="logout">{{ logoutFailed ? '로그아웃하지 못했어요 · 다시 누르기' : '로그아웃' }}</button>
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
  background: linear-gradient(90deg, var(--gold-warm), var(--gold));
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
.group-toggle {
  display: grid;
  place-items: center;
  width: 22px;
  margin-left: -12px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  cursor: pointer;
}
.group-toggle svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
  transition: rotate var(--fast) ease;
}
.group-toggle:hover,
.group.open .group-toggle {
  color: var(--text);
}
.group.open .group-toggle svg {
  rotate: 180deg;
}
.group.on .group-link::after {
  content: "";
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 3px;
  background: var(--gold);
  border-radius: 3px 3px 0 0;
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent);
}
/* 썬데이 등: 발표 전엔 꺼진 회색, 발표되면 금색으로 켜지고 안 봤으면 깜빡인다 */
.lamp {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--lamp-off);
  border: 1px solid var(--tip-line);
  border-radius: 50%;
  transition: background var(--normal) ease, box-shadow var(--normal) ease;
}
.lamp.on {
  background: var(--gold);
  border-color: var(--lamp-gold);
  box-shadow: 0 0 8px var(--gold), 0 0 2px #fff inset;
}
.lamp.on.today {
  background: var(--gain);
  border-color: var(--lamp-green);
  box-shadow: 0 0 8px var(--gain);
}
.lamp.blink {
  animation: blink 1.6s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.4; }
}
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
  background: color-mix(in srgb, var(--gain) 15%, transparent);
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
/* 마우스로 누른 링크엔 포커스가 남아 focus-within이면 안 닫히고 겹쳐 뜨므로 키보드 포커스일 때만 연다 */
.group:hover .drop,
.group.open .drop,
.group:has(:focus-visible) .drop {
  opacity: 1;
  pointer-events: auto;
  translate: 0 0;
}
.groups:has(.group:hover) .group:not(:hover, .open) .drop {
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
.drop-item.failed {
  color: var(--loss);
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
  background: color-mix(in srgb, var(--gold) 10%, transparent);
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
  background: color-mix(in srgb, var(--gold) 20%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 30%, transparent);
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
  background: color-mix(in srgb, var(--gold) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 40%, transparent);
  color: var(--gold);
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
    padding: 0 16px;
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
    padding: 0 16px;
  }
}
</style>
