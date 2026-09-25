<script lang="ts" setup>
import { computed } from 'vue';
import type { CompanionEntry } from '@/services/dndbeyond/model';
import { ABILITIES } from '@/utils/character/dnd5e';
import RichText from '@/components/RichText.vue';

const props = withDefaults(
  defineProps<{ companions: CompanionEntry[]; columns?: number }>(),
  { columns: 3 },
);
const abilityGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, props.columns))}, minmax(0, 1fr))`,
}));
const abilityNames = new Map<string, string>(ABILITIES.map(({ key, name }) => [key, name]));
const abilityName = (key: string) => abilityNames.get(key.trim().toLowerCase()) ?? key;
</script>

<template>
  <div class="companions">
    <section
      v-for="(companion, index) in companions"
      :key="`${companion.source}-${companion.name}-${index}`"
      class="companion"
      data-card-group
      data-companion
    >
      <div data-companion-part>
        <header class="companion__header">
          <strong class="companion__name">{{ companion.name }}</strong>
          <span v-if="companion.source !== companion.name" class="companion__source">{{ companion.source }}</span>
          <span v-if="companion.meta" class="companion__meta">{{ companion.meta }}</span>
        </header>
        <dl class="companion__vitals">
          <div v-if="companion.challengeRating"><dt>CR</dt><dd>{{ companion.challengeRating }}</dd></div>
          <div v-if="companion.armorClass"><dt>AC</dt><dd>{{ companion.armorClass }}</dd></div>
          <div v-if="companion.hitPoints"><dt>HP</dt><dd>{{ companion.hitPoints }}</dd></div>
          <div v-if="companion.speed"><dt>Speed</dt><dd>{{ companion.speed }}</dd></div>
        </dl>
        <div v-if="companion.abilities.length" class="companion__abilities" :style="abilityGridStyle">
          <div v-for="ability in companion.abilities" :key="ability.key" class="companion__ability">
            <strong>{{ abilityName(ability.key) }}</strong>
            <span>{{ ability.score }}</span>
            <span v-if="ability.modifier">Mod <b>{{ ability.modifier }}</b></span>
            <span v-if="ability.save">Save <b>{{ ability.save }}</b></span>
          </div>
        </div>
      </div>
      <div
        v-for="(detail, detailIndex) in companion.details"
        :key="detailIndex"
        class="companion__detail"
        data-companion-part
      >
        <strong
          v-if="detailIndex === 0 || companion.details[detailIndex - 1]?.section !== detail.section"
          class="companion__section"
        >{{ detail.section }}</strong>
        <p>
          <strong v-if="detail.label" class="companion__detail-label">{{ detail.label }}</strong>
          <RichText :text="detail.text" />
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.companions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.companion {
  overflow-wrap: anywhere;
}

.companion + .companion {
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
  padding-top: 10px;
}

.companion__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.companion__name {
  font-size: 15px;
}

.companion__source,
.companion__meta {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
}

.companion__meta {
  flex-basis: 100%;
}

.companion__vitals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 8px 0;
  font-size: 12px;
}

.companion__vitals div {
  display: flex;
  gap: 4px;
}

.companion__vitals dt {
  font-weight: 700;
}

.companion__vitals dd {
  margin: 0;
}

.companion__abilities {
  display: grid;
  gap: 4px 12px;
  margin-bottom: 8px;
  font-size: 12px;
}

.companion__ability {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 6px;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
}

.companion__ability > strong {
  flex-basis: 100%;
}

.companion__detail {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.3;
}

.companion__section {
  display: block;
  color: var(--p-text-muted-color, #888);
}

.companion__detail p {
  margin: 2px 0 0;
}

.companion__detail-label {
  margin-right: 4px;
}
</style>
