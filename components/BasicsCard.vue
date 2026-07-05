<script lang="ts" setup>
import type { CharacterBasics } from '@/services/dndbeyond/model';
import { formatModifier } from '@/utils/dnd5e';

defineProps<{ basics: CharacterBasics }>();
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
      <span class="basics__conditions-value">{{
        basics.conditions.length ? basics.conditions.join(', ') : 'None'
      }}</span>
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
  font-size: 12px;
  font-weight: 400;
}

.basics__sep {
  margin: 0 1px;
  color: var(--p-text-muted-color, #888);
  font-weight: 400;
}

.basics__label {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
  text-align: center;
}

.basics__conditions {
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid var(--p-content-border-color, #e5e5e5);
}

.basics__conditions-value {
  font-size: 13px;
  font-weight: 600;
}
</style>
