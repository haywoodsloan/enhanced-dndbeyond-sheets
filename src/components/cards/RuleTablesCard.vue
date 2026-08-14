<script lang="ts" setup>
import type { RuleTable } from '@/services/dndbeyond/model';

defineProps<{ tables: RuleTable[] }>();

function columnsFor(table: RuleTable): string {
  return `repeat(${Math.max(1, table.columns.length)}, minmax(40px, auto))`;
}

/** Roll results centre nicely under their die; names and items don't. */
function rollKeyed(table: RuleTable): boolean {
  return /^(?:\d*d\d+|roll)$/i.test((table.columns[0] ?? '').replace(/\s+/g, ''));
}
</script>

<template>
  <div class="rule-tables">
    <section
      v-for="table in tables"
      :key="`${table.source}-${table.title}`"
      class="rule-table"
      data-card-group
      data-rule-table
    >
      <header class="rule-table__title" data-rule-row>
        <span>{{ table.title }}</span>
        <span v-if="table.source !== table.title" class="rule-table__source">
          {{ table.source }}
        </span>
      </header>
      <div
        class="rule-table__grid"
        :class="{ 'rule-table__grid--roll': rollKeyed(table) }"
        :style="{ gridTemplateColumns: columnsFor(table) }"
      >
        <div
          v-if="table.columns.length"
          class="rule-table__row rule-table__head"
          data-rule-row
        >
          <span v-for="(column, index) in table.columns" :key="index">{{ column }}</span>
        </div>
        <div
          v-for="(row, rowIndex) in table.rows"
          :key="rowIndex"
          class="rule-table__row"
          data-rule-row
        >
          <span v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rule-tables {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-table + .rule-table {
  padding-top: 10px;
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
}

.rule-table__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 700;
}

.rule-table__source {
  font-size: 11px;
  font-weight: 500;
  color: var(--p-text-muted-color, #888);
}

/* One shared grid for the header and every row (via `subgrid`), so a column is
   the same width on every row. The grid is only as wide as its widest cells, so
   a two-column lookup doesn't stretch a narrow value across the whole card. */
.rule-table__grid {
  display: grid;
  width: max-content;
  max-width: 100%;
}

.rule-table__row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
  font-size: 11px;
  line-height: 1.25;
}

.rule-table__row > span {
  min-width: 0;
  padding: 4px 6px;
}

.rule-table__row > span + span {
  border-left: 1px solid var(--p-primary-200, #e4e4e7);
}

.rule-table__head {
  font-weight: 700;
  color: var(--p-text-muted-color, #888);
  border-top: 0;
  background: var(--p-primary-50, #fafafa);
}

.rule-table__row:not(.rule-table__head) > span:first-child {
  font-weight: 700;
}

.rule-table__grid--roll .rule-table__row:not(.rule-table__head) > span:first-child {
  text-align: center;
}
</style>
