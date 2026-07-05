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
    <div class="basics__stat" data-stat="ac">
      <span class="basics__value">{{ basics.armorClass }}</span>
      <span class="basics__label">Armor Class</span>
    </div>

    <div class="basics__stat" data-stat="hp">
      <span class="basics__value">
        {{ basics.hitPoints.current }}<span class="basics__sep">/</span>{{
          basics.hitPoints.max
        }}
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
</template>

<style scoped>
.basics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.basics__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

.basics__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.basics__value small {
  font-size: 13px;
  font-weight: 400;
}

.basics__sep {
  margin: 0 1px;
  color: var(--p-text-muted-color, #888);
  font-weight: 400;
}

.basics__label {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
  text-align: center;
}

.basics__conditions {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 8px 4px;
  border-top: 1px solid var(--p-content-border-color, #e5e5e5);
}

.conditions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conditions__box {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.conditions__box input {
  margin: 0;
}
</style>
