<script lang="ts" setup>
import { computed } from 'vue';
import type { FeatureTable } from '@/services/dndbeyond/model';
import RichText from '@/components/RichText.vue';

const props = defineProps<{ table: FeatureTable; breakRows?: boolean }>();
const rollKeyed = computed(() =>
  /^(?:\d*d\d+|roll)$/i.test((props.table.columns[0] ?? '').replace(/\s+/g, '')),
);
</script>

<template>
  <table class="rules-grid" :class="{ 'rules-grid--roll': rollKeyed }">
    <thead v-if="table.columns.length">
      <tr :data-rule-row="breakRows ? '' : undefined">
        <th v-for="(column, index) in table.columns" :key="index" scope="col">{{ column }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in table.rows" :key="index" :data-rule-row="breakRows ? '' : undefined">
        <td v-for="(cell, cellIndex) in row" :key="cellIndex"><RichText :text="cell" /></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.rules-grid {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.3;
}

.rules-grid th,
.rules-grid td {
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--p-primary-200, #e4e4e7);
}

.rules-grid th {
  font-weight: 700;
  background: var(--p-primary-50, #fafafa);
}

.rules-grid th + th,
.rules-grid td + td {
  border-left: 1px solid var(--p-primary-200, #e4e4e7);
}

.rules-grid--roll th:first-child {
  width: 4em;
}

.rules-grid--roll td:first-child {
  text-align: center;
  font-weight: 600;
}
</style>
