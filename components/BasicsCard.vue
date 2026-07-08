<script lang="ts" setup>
import { computed } from 'vue';
import type { CharacterBasics } from '@/services/dndbeyond/model';
import { CONDITION_NAMES, formatModifier } from '@/utils/dnd5e';

const props = defineProps<{ basics: CharacterBasics }>();

// Every condition is listed with a checkbox so the printed sheet can be marked
// by hand during play; conditions already active on the character are pre-checked.
const activeConditions = computed(() => new Set(props.basics.conditions));
</script>

<template>
  <div class="basics">
    <div class="basics__stats">
      <div class="basics__stat" data-stat="ac">
        <span class="basics__value">{{ basics.armorClass }}</span>
        <span class="basics__label">Armor Class</span>
      </div>

      <div class="basics__stat" data-stat="hp">
        <span class="basics__value">
          <span class="basics__blank" aria-hidden="true"></span
          ><span class="basics__sep">/</span>{{ basics.hitPoints.max }}
        </span>
        <span class="basics__label">
          Hit Points<template v-if="basics.hitPoints.temp > 0">
            (+{{ basics.hitPoints.temp }} temp)</template
          >
        </span>
      </div>

      <div class="basics__stat" data-stat="initiative">
        <span class="basics__value">{{ formatModifier(basics.initiative) }}</span>
        <span class="basics__label">Initiative</span>
      </div>

      <div class="basics__stat" data-stat="speed">
        <span class="basics__value">{{ basics.speed }}<small> ft</small></span>
        <span class="basics__label">Speed</span>
      </div>

      <div class="basics__stat" data-stat="proficiency">
        <span class="basics__value">{{
          formatModifier(basics.proficiencyBonus)
        }}</span>
        <span class="basics__label">Proficiency</span>
      </div>
    </div>

    <div class="basics__bottom">
      <div class="basics__deathsaves" data-stat="death-saves">
        <span class="basics__label">Death Saves</span>
        <div class="deathsaves">
          <div class="deathsaves__track">
            <span class="deathsaves__caption">Successes</span>
            <span class="deathsaves__boxes">
              <input
                v-for="n in 3"
                :key="n"
                type="checkbox"
                aria-label="Death save success"
              />
            </span>
          </div>
          <div class="deathsaves__track">
            <span class="deathsaves__caption">Failures</span>
            <span class="deathsaves__boxes">
              <input
                v-for="n in 3"
                :key="n"
                type="checkbox"
                aria-label="Death save failure"
              />
            </span>
          </div>
        </div>
      </div>

      <div class="basics__conditions" data-stat="conditions">
        <span class="basics__label">Conditions</span>
        <ul class="conditions">
          <li v-for="name in CONDITION_NAMES" :key="name" class="conditions__item">
            <label class="conditions__box">
              <input type="checkbox" :checked="activeConditions.has(name)" />
              <span>{{ name }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.basics {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Core combat stats across the top. */
.basics__stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.basics__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 12px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

.basics__value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
}

.basics__value small {
  font-size: 12px;
  font-weight: 400;
}

.basics__sep {
  margin: 0 1px;
  color: var(--p-text-muted-color, #888);
  font-weight: 400;
}

/* Current HP is left blank for the player to fill in during play. */
.basics__blank {
  display: inline-block;
  min-width: 1.6em;
  vertical-align: -0.2em;
  border-bottom: 1.5px solid var(--p-text-muted-color, #888);
}

.basics__label {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
  text-align: center;
}

/* Death saves and the condition checklist share the lower band, side by side. */
.basics__bottom {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: stretch;
}

.basics__deathsaves,
.basics__conditions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* Thin divider so the death saves and conditions read as separate groups. */
.basics__conditions {
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
  padding-left: 16px;
}

.basics__deathsaves .basics__label,
.basics__conditions .basics__label {
  text-align: left;
  font-weight: 600;
}

.deathsaves {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.deathsaves__track {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.deathsaves__caption {
  min-width: 60px;
  color: var(--p-text-muted-color, #888);
}

.deathsaves__boxes {
  display: inline-flex;
  gap: 6px;
}

.deathsaves__boxes input {
  margin: 0;
}

.conditions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  grid-auto-rows: min-content;
  gap: 2px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conditions__item {
  min-width: 0;
}

.conditions__box {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  line-height: 1.3;
}

.conditions__box input {
  margin: 0;
}
</style>
