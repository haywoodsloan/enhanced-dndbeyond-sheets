<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CharacterProficiencies } from '@/services/dndbeyond/model';

const props = defineProps<{ proficiencies: CharacterProficiencies; columns?: number }>();

interface ProficiencyGroup {
  label: string;
  items: string[];
}

const groups = computed<ProficiencyGroup[]>(() =>
  [
    { label: 'Languages', items: props.proficiencies.languages },
    { label: 'Weapons', items: props.proficiencies.weapons },
    { label: 'Armor', items: props.proficiencies.armor },
    { label: 'Tools', items: props.proficiencies.tools },
  ].filter((group) => group.items.length > 0),
);

const requestedColumnCount = computed(() => Math.max(1, props.columns ?? 1));
const fittedColumnCount = ref(requestedColumnCount.value);
const columnCount = computed(() => fittedColumnCount.value);
const compact = ref(false);

// Multi-column layouts stack each category as a heading with one item per line;
// the single-column layout keeps the compact "Label: a, b, c" inline form.
const stacked = computed(() => columnCount.value > 1 && !compact.value);

function groupWeight(group: ProficiencyGroup): number {
  return group.items.reduce(
    (total, item) => total + Math.max(1, Math.ceil(item.length / 24)),
    1,
  );
}

function balanceGroups(source: ProficiencyGroup[], count: number): ProficiencyGroup[][] {
  const columns = Array.from({ length: count }, () => ({
    groups: [] as ProficiencyGroup[],
    weight: 0,
  }));
  for (const group of source) {
    const target = columns.reduce((lightest, column) =>
      column.weight < lightest.weight ? column : lightest,
    );
    target.groups.push(group);
    target.weight += groupWeight(group);
  }
  return columns.map((column) => column.groups).filter((column) => column.length > 0);
}

const columnGroups = computed(() => {
  const count = Math.min(columnCount.value, Math.max(1, groups.value.length));
  if (count >= 3) {
    const dedicated = groups.value.reduce((longest, group) => {
      const difference = groupWeight(group) - groupWeight(longest);
      return difference > 0 || (difference === 0 && group.label === 'Tools') ? group : longest;
    });
    const remaining = groups.value.filter((group) => group !== dedicated);
    return [...balanceGroups(remaining, count - 1), [dedicated]];
  }
  return balanceGroups(groups.value, count);
});

const profsRef = ref<HTMLElement | null>(null);
let fitRequest = 0;

function overflows(root: HTMLElement): boolean {
  return [...root.querySelectorAll<HTMLElement>('.profs__column')].some(
    (column) => column.scrollHeight > root.clientHeight + 1,
  );
}

async function fitColumns() {
  const request = ++fitRequest;
  fittedColumnCount.value = requestedColumnCount.value;
  compact.value = false;
  if (requestedColumnCount.value !== 2 || groups.value.length < 3) return;
  await nextTick();
  if (request !== fitRequest) return;
  const root = profsRef.value;
  if (!root || root.clientHeight <= 0 || !overflows(root)) return;
  fittedColumnCount.value = 3;
  await nextTick();
  if (request !== fitRequest) return;
  if (overflows(root)) compact.value = true;
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  void fitColumns();
  if (typeof document !== 'undefined') void document.fonts?.ready?.then(() => fitColumns());
  if (typeof ResizeObserver !== 'undefined' && profsRef.value) {
    observer = new ResizeObserver(() => void fitColumns());
    observer.observe(profsRef.value);
  }
});
onBeforeUnmount(() => {
  fitRequest += 1;
  observer?.disconnect();
  observer = null;
});
watch(
  () => [props.columns, props.proficiencies],
  () => void fitColumns(),
  { deep: true },
);
</script>

<template>
  <div
    ref="profsRef"
    class="profs"
    :class="{
      'profs--stacked': stacked,
      'profs--dense': columnCount >= 3,
      'profs--compact': compact,
    }"
  >
    <div v-for="(column, colIndex) in columnGroups" :key="colIndex" class="profs__column">
      <div
        v-for="group in column"
        :key="group.label"
        class="profs__group"
        :data-group="group.label"
      >
        <template v-if="stacked">
          <span class="profs__heading">{{ group.label }}</span>
          <ul class="profs__list">
            <li v-for="item in group.items" :key="item" class="profs__item">{{ item }}</li>
          </ul>
        </template>
        <template v-else>
          <span class="profs__label">{{ group.label }}:</span>
          <span class="profs__items">{{ group.items.join(', ') }}</span>
        </template>
      </div>
    </div>
    <p v-if="groups.length === 0" class="profs__empty">None</p>
  </div>
</template>

<style scoped>
.profs {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
}

.profs--dense {
  gap: 10px;
}

.profs__column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* Spread the groups down the full card height so the wider layout doesn't
     leave empty space at the bottom; `gap` is the minimum spacing. */
  justify-content: space-between;
  gap: 6px;
}

/* The stacked format's headings + item lists are taller, so distributing them
   with space-between over-separates the categories; pack them from the top with
   a small fixed gap (and keep the column tops aligned) instead. */
.profs--stacked .profs__column {
  justify-content: flex-start;
  gap: 12px;
}

.profs--dense .profs__column {
  gap: 6px;
}

.profs--dense .profs__group {
  line-height: 1.25;
}

.profs--compact .profs__column {
  justify-content: flex-start;
}

.profs__group {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
}

.profs__label {
  margin-right: 5px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__items {
  color: #1c1c1e;
}

/* Stacked (multi-column) format: a category heading with one item per line. */
.profs__heading {
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
}

.profs__list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.profs__item {
  color: #1c1c1e;
  overflow-wrap: anywhere;
}

.profs__empty {
  margin: 0;
  font-size: 13px;
  color: var(--p-text-muted-color, #888);
}
</style>
