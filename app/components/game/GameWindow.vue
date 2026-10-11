<script setup lang="ts">
withDefaults(defineProps<{ title: string, sub?: string, accent?: 'gold' | 'blue' | 'purple' | 'green' | 'red', fill?: boolean }>(), { accent: 'gold' })
</script>

<template>
  <section class="win" :class="[accent, { fill }]">
    <header class="win-t">
      <span class="dot" aria-hidden="true" />
      <h2 class="ellipsis">{{ title }}</h2>
      <span v-if="sub || $slots.sub" class="win-sub ellipsis"><slot name="sub">{{ sub }}</slot></span>
    </header>
    <div class="win-b">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.win {
  --accent: var(--gold);
  min-width: 0;
  overflow: hidden;
  background:
    radial-gradient(500px 160px at 0 0, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
    var(--win);
  border: 2px solid var(--win-line);
  border-radius: 12px;
  box-shadow: 0 0 0 2px var(--bar), 0 12px 32px rgb(0 0 0 / 0.28);
  animation: rise-in 0.5s var(--ease-out) backwards;
  transition: border-color var(--normal) ease;
}
.win:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--win-line));
}
.blue { --accent: var(--api); }
.purple { --accent: var(--calc); }
.green { --accent: var(--gain); }
.red { --accent: var(--loss); }
.win-t {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 9px 16px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, var(--title)), var(--title) 70%);
  border-bottom: 2px solid var(--win-line);
}
.dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
.win-t h2 {
  min-width: 0;
  margin: 0;
  color: var(--accent);
  font-family: var(--f-title);
  font-size: 21px;
  font-weight: 400;
}
.win-sub {
  flex-shrink: 1;
  min-width: 0;
  margin-left: auto;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 15px;
}
.win-b {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
  padding: 16px;
}
.fill {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.fill .win-b {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
@media (max-width: 480px) {
  .win-sub {
    display: none;
  }
}
</style>
