<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { InventoryEntry } from '@/services/dndbeyond/model';

const props = defineProps<{ inventory: InventoryEntry[]; columns?: number }>();

// Split into N balanced columns (from the chosen layout) so each footprint uses
// its full width; every column carries its own header so the circles stay
// labeled. Empty trailing columns are dropped.
const columnGroups = computed(() => {
  const count = Math.max(1, props.columns ?? 3);
  const size = Math.ceil(props.inventory.length / count);
  return Array.from({ length: count }, (_, index) =>
    props.inventory.slice(index * size, (index + 1) * size),
  ).filter((column) => column.length > 0);
});

// Minimum blank write-in rows per column (before measuring): fewer once the list
// splits three ways so the narrower columns don't get too tall on their own.
const baseRows = computed(() => (columnGroups.value.length >= 3 ? 1 : 2));

// Approx height (px) of one blank row — name 18 + divider 1 + two 3px grid gaps.
const BLANK_ROW_PX = 25;

const inventoryRef = ref<HTMLElement | null>(null);
// Blank rows per column, grown past `baseRows` to fill each column's spare
// height so the write-in area reaches the bottom of the card.
const blankCounts = ref<number[]>([]);

function measure() {
  const inv = inventoryRef.value;
  if (!inv) return;
  const base = baseRows.value;
  const next = Array.from(inv.querySelectorAll<HTMLElement>('.column')).map((column) => {
    const sentinel = column.querySelector<HTMLElement>('.column__sentinel');
    if (!sentinel) return base;
    const spare = column.getBoundingClientRect().bottom - sentinel.getBoundingClientRect().bottom;
    return Math.max(base, Math.floor(spare / BLANK_ROW_PX));
  });
  const changed =
    next.length !== blankCounts.value.length ||
    next.some((value, index) => value !== blankCounts.value[index]);
  if (changed) blankCounts.value = next;
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  void nextTick(measure);
  // Re-fit once webfonts settle (they can change the item heights).
  if (typeof document !== 'undefined') void document.fonts?.ready?.then(() => measure());
  if (typeof ResizeObserver !== 'undefined' && inventoryRef.value) {
    observer = new ResizeObserver(() => measure());
    observer.observe(inventoryRef.value);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
// Re-fit when the item count or column split changes (card resizes are caught by
// the ResizeObserver). Clear first so stale per-column counts don't flash.
watch(
  () => [props.columns, props.inventory.length],
  () => {
    blankCounts.value = [];
    void nextTick(measure);
  },
);
</script>

<template>
  <div class="inventory" ref="inventoryRef">
    <div v-for="(column, colIndex) in columnGroups" :key="colIndex" class="column">
      <span class="column__spacer" aria-hidden="true"></span>
      <span class="column__label" title="Equipped">Equip</span>
      <span class="column__label" title="Attuned">Attune</span>
      <template v-for="(item, index) in column" :key="index">
        <span v-if="index > 0" class="item__divider" aria-hidden="true"></span>
        <span class="item__name" data-item>
          {{ item.name }}
          <span v-if="item.quantity > 1" class="item__qty">×{{ item.quantity }}</span>
        </span>
        <span
          class="item__dot"
          :class="{ 'item__dot--on': item.equipped }"
          :title="item.equipped ? 'Equipped' : 'Not equipped'"
        ></span>
        <span
          class="item__dot"
          :class="{ 'item__dot--on': item.attuned }"
          :title="item.attuned ? 'Attuned' : 'Not attuned'"
        ></span>
      </template>
      <!-- Marks where the items end so the blank rows below can measure the
           column's leftover height. -->
      <span class="column__sentinel" aria-hidden="true"></span>
      <!-- Blank write-in rows for gear gained during play; grown to fill the
           column's spare height. Each row's divider is its write-line (a line
           above it, like the item rows), so no trailing divider is needed — and
           leaving it off keeps the fill an exact number of rows (no clipping). -->
      <template v-for="n in (blankCounts[colIndex] ?? baseRows)" :key="`blank-${n}`">
        <span class="item__divider" aria-hidden="true"></span>
        <span class="item__name item__name--blank" data-item-blank></span>
        <span class="item__dot"></span>
        <span class="item__dot"></span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.inventory {
  display: flex;
  align-items: stretch;
  /* Fill the card height (SectionCard stretches the content) so the blank
     write-in rows grow into the leftover space. The -6px nudges the columns up
     under the title; the matching +6px height keeps the bottom at the card edge
     so the last write-in row reaches it instead of being cut short. */
  height: calc(100% + 6px);
  margin-top: -6px;
}

.column {
  flex: 1;
  min-width: 0;
  padding: 0 14px;
  display: grid;
  grid-template-columns: 1fr auto auto;
  column-gap: 8px;
  row-gap: 3px;
  align-content: start;
  /* Clip any blank row that overshoots the measured leftover height. */
  overflow: hidden;
}

.column:first-child {
  padding-left: 0;
}

.column:last-child {
  padding-right: 0;
}

/* A thin divider between columns so the three lists are easy to scan. */
.column + .column {
  border-left: 1px solid var(--p-primary-200, #d4d4d8);
}

.column__label {
  justify-self: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color, #888);
  white-space: nowrap;
}

.item__name {
  min-width: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}

/* Zero-height marker after the last item; the blank rows measure the gap
   between it and the column's bottom to know how many will fit. */
.column__sentinel {
  grid-column: 1 / -1;
  height: 0;
}

/* Blank write-in rows: the dividers above/below give the line to write on; a
   fixed height keeps the fill math (how many fit the leftover space) stable. */
.item__name--blank {
  height: 18px;
}

/* Subtle full-width rule between item rows (items carry no bullet marker). */
.item__divider {
  grid-column: 1 / -1;
  height: 1px;
  background: var(--p-primary-200, #e5e7eb);
}

.item__qty {
  font-size: 12px;
  color: var(--p-text-muted-color, #888);
}

.item__dot {
  align-self: center;
  justify-self: center;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--p-text-muted-color, #888);
  border-radius: 50%;
}

.item__dot--on {
  background: var(--p-primary-color, #1c1c1e);
  border-color: var(--p-primary-color, #1c1c1e);
}
</style>
