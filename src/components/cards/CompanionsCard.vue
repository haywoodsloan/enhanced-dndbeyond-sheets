<script lang="ts" setup>
import { computed } from 'vue';
import type { CompanionEntry } from '@/services/dndbeyond/model';
import { ABILITIES } from '@/utils/character/dnd5e';

const props = withDefaults(
  defineProps<{ companions: CompanionEntry[]; columns?: number }>(),
  { columns: 3 },
);

const abilityGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, props.columns))}, minmax(140px, 160px))`,
  justifyContent: 'center',
}));

const abilityNames = new Map<string, string>(
  ABILITIES.map(({ key, name }) => [key, name]),
);

function formatAbilityName(key: string): string {
  return abilityNames.get(key.trim().toLowerCase()) ?? key;
}
</script>

<template>
  <div class="companions">
    <section
      v-for="companion in companions"
      :key="`${companion.source}-${companion.name}`"
      class="companion"
      data-card-group
      data-companion
    >
      <div class="companion__intro" data-companion-part>
        <header class="companion__header">
          <span class="companion__name">{{ companion.name }}</span>
          <span v-if="companion.source !== companion.name" class="companion__source">
            {{ companion.source }}
          </span>
          <span v-if="companion.meta" class="companion__meta">{{ companion.meta }}</span>
        </header>

        <dl
          v-if="
            companion.challengeRating ||
            companion.armorClass ||
            companion.hitPoints ||
            companion.speed
          "
          class="companion__vitals"
        >
          <div v-if="companion.challengeRating">
            <dt>CR</dt>
            <dd>{{ companion.challengeRating }}</dd>
          </div>
          <div v-if="companion.armorClass">
            <dt>AC</dt>
            <dd>{{ companion.armorClass }}</dd>
          </div>
          <div v-if="companion.hitPoints">
            <dt>HP</dt>
            <dd>{{ companion.hitPoints }}</dd>
          </div>
          <div v-if="companion.speed">
            <dt>Speed</dt>
            <dd>{{ companion.speed }}</dd>
          </div>
        </dl>

        <div
          v-if="companion.abilities.length"
          class="companion__abilities"
          :style="abilityGridStyle"
        >
          <div v-for="ability in companion.abilities" :key="ability.key" class="companion__ability">
            <span class="companion__ability-key">{{ formatAbilityName(ability.key) }}</span>
            <span class="companion__ability-score">{{ ability.score }}</span>
            <span v-if="ability.modifier" class="companion__ability-value">
              <span class="companion__ability-label">Mod</span>
              <strong class="companion__ability-mod">{{ ability.modifier }}</strong>
            </span>
            <span v-if="ability.save" class="companion__ability-value">
              <span class="companion__ability-label">Save</span>
              <strong class="companion__ability-save">{{ ability.save }}</strong>
            </span>
          </div>
        </div>
      </div>

      <div
        v-for="(detail, index) in companion.details"
        :key="`${detail.section}-${detail.label}-${index}`"
        class="companion__detail"
        data-companion-part
      >
        <span
          v-if="index === 0 || companion.details[index - 1]?.section !== detail.section"
          class="companion__section"
        >
          {{ detail.section }}
        </span>
        <p>
          <strong v-if="detail.label">{{ detail.label }}</strong>
          <span>{{ detail.text }}</span>
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

.companion + .companion {
  padding-top: 10px;
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
}

.companion__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.companion__name {
  font-size: 15px;
  font-weight: 700;
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
  gap: 4px 18px;
  margin: 10px 0;
  font-size: 12px;
}

.companion__vitals div {
  display: flex;
  gap: 4px;
}

.companion__vitals dt {
  flex: none;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--p-primary-100, #f4f4f5);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
}

.companion__vitals dd {
  margin: 0;
  color: var(--p-text-muted-color, #888);
}

.companion__abilities {
  display: grid;
  gap: 0 10px;
  margin-bottom: 5px;
}

.companion__ability {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 10px;
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 6px;
}

.companion__ability-key {
  font-size: 13px;
  font-weight: 700;
}

.companion__ability-score {
  justify-self: end;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}

.companion__ability-value {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  white-space: nowrap;
}

.companion__ability-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #888);
}

.companion__ability-mod,
.companion__ability-save {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1c1c1e;
}

.companion__section {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color, #888);
  text-transform: uppercase;
}

.companion__detail p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--p-text-muted-color, #888);
}

.companion__detail strong {
  margin-right: 4px;
  color: #1c1c1e;
}
</style>
