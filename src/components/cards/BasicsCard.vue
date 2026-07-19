<script lang="ts" setup>
import { computed } from 'vue';
import type { CharacterBasics } from '@/services/dndbeyond/model';
import { CONDITION_NAMES, formatModifier } from '@/utils/character/dnd5e';

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
        <div class="basics__stack">
          <span class="basics__value">
            <span class="basics__blank" aria-hidden="true"></span
            ><span class="basics__sep">/</span>{{ basics.hitPoints.max }}
            <span class="basics__temp">
              <span class="basics__temp-blank" aria-hidden="true"></span>
              <span class="basics__temp-label">TEMP</span>
            </span>
          </span>
        </div>
        <span class="basics__label">Hit Points</span>
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
      <div class="basics__trackers">
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

        <div class="basics__gauges">
          <div
            v-if="basics.hitDice.length"
            class="basics__hitdice"
            data-stat="hit-dice"
          >
            <span class="basics__label">Hit Dice</span>
            <div class="hitdice">
              <div
                v-for="hd in basics.hitDice"
                :key="hd.die"
                class="hitdice__group"
              >
                <span class="hitdice__pool">
                  <span class="hitdice__blank" aria-hidden="true"></span
                  ><span class="hitdice__sep">/</span>{{ hd.count }}
                </span>
                <span class="hitdice__die">(d{{ hd.die }})</span>
              </div>
            </div>
          </div>

          <label class="basics__inspiration" data-stat="inspiration">
            <input type="checkbox" :checked="basics.inspiration" />
            <span class="basics__label">Inspiration</span>
          </label>
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
  gap: 10px;
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
  /* Value (and, for HP, the temp write-in) sit at the top; the title is pinned
     to the bottom of the box. */
  justify-content: space-between;
  gap: 2px;
  padding: 12px 4px 4px;
  border: 1px solid var(--p-content-border-color, #e5e5e5);
  border-radius: 8px;
}

/* HP puts its current/max value and the temp-HP write-in on ONE line at the top
   of the box, keeping the title pinned to the bottom like the other boxes. The
   padding-bottom reserves room for the TEMP caption that hangs below the line. */
.basics__stack {
  display: flex;
  justify-content: center;
  padding-bottom: 12px;
}

.basics__value {
  font-size: 18px;
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

/* Current HP is left blank for the player to fill in during play. */
.basics__blank {
  display: inline-block;
  min-width: 2.05em;
  vertical-align: -0.2em;
  border-bottom: 1.5px solid var(--p-text-muted-color, #888);
}

/* Temp HP: a write-in line sharing the value's line (so it lines up exactly with
   the current-HP blank via the same baseline offset), with a small "TEMP"
   caption absolutely placed just below it. */
.basics__temp {
  position: relative;
  display: inline-block;
  width: 1.75em;
  margin-left: 4px;
  vertical-align: -0.2em;
}

.basics__temp-blank {
  display: block;
  border-bottom: 1.5px solid var(--p-text-muted-color, #888);
}

.basics__temp-label {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 3px;
  text-align: center;
  font-size: 9px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color, #888);
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

/* Hand-tracked bits sit left of the conditions grid: death saves and the
   hit-dice / inspiration gauges side by side, so the band stays about as short
   as the conditions checklist instead of stacking taller than it. */
.basics__trackers {
  display: flex;
  gap: 22px;
  min-width: 0;
  /* Nudge the hit-dice / death-save columns down a little from the top. */
  padding-top: 8px;
}

.basics__gauges {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  /* Hit dice / inspiration sit to the left of the death saves. */
  order: -1;
}

.basics__deathsaves,
.basics__hitdice,
.basics__conditions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* Hit dice: a remaining/total write-in per die size (d8 with a blank over 4), so
   the tracker stays one line per die regardless of level instead of overflowing
   with a box per level. Mirrors the HP tile's blank/max form. */
.hitdice {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hitdice__group {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 13px;
}

.hitdice__die {
  color: var(--p-text-muted-color, #888);
  font-variant-numeric: tabular-nums;
}

.hitdice__pool {
  font-variant-numeric: tabular-nums;
}

.hitdice__blank {
  display: inline-block;
  min-width: 1.9em;
  vertical-align: -0.1em;
  border-bottom: 1.5px solid var(--p-text-muted-color, #888);
}

.hitdice__sep {
  margin-left: 3px;
  color: var(--p-text-muted-color, #888);
}

/* Inspiration: a single header-styled toggle. */
.basics__inspiration {
  display: flex;
  align-items: center;
  gap: 6px;
}

.basics__inspiration input {
  margin: 0;
}

/* Thin divider so the death saves and conditions read as separate groups. */
.basics__conditions {
  border-left: 1px solid var(--p-primary-300, #d4d4d8);
  padding-left: 16px;
}

.basics__trackers .basics__label,
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
