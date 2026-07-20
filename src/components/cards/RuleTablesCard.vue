<script lang="ts" setup>
import type { RuleTable } from '@/services/dndbeyond/model';

defineProps<{ tables: RuleTable[] }>();

function columnsFor(table: RuleTable): string {
  const trailing = Math.max(0, table.columns.length - 1);
  return trailing
    ? `minmax(40px, max-content) repeat(${trailing}, minmax(0, 1fr))`
    : 'minmax(0, 1fr)';
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
        v-if="table.columns.length"
        class="rule-table__row rule-table__head"
        :style="{ gridTemplateColumns: columnsFor(table) }"
        data-rule-row
      >
        <span v-for="(column, index) in table.columns" :key="index">{{ column }}</span>
      </div>
      <div
        v-for="(row, rowIndex) in table.rows"
        :key="rowIndex"
        class="rule-table__row"
        :style="{ gridTemplateColumns: columnsFor(table) }"
        data-rule-row
      >
        <span v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</span>
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

.rule-table__row {
  display: grid;
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
  text-align: center;
}
</style>
