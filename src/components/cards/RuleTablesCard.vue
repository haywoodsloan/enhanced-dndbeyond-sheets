<script lang="ts" setup>
import type { RuleTable } from '@/services/dndbeyond/model';
import RulesGrid from '@/components/cards/RulesGrid.vue';

defineProps<{ tables: RuleTable[] }>();
</script>

<template>
  <div class="rule-tables">
    <section
      v-for="(table, index) in tables"
      :key="`${table.source}-${table.title}-${index}`"
      class="rule-table"
      data-card-group
      data-rule-table
    >
      <header class="rule-table__title">
        <strong>{{ table.title }}</strong>
        <span v-if="table.source !== table.title" class="rule-table__source">{{ table.source }}</span>
      </header>
      <RulesGrid :table="table" break-rows />
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
  border-top: 1px solid var(--p-primary-200, #e4e4e7);
  padding-top: 10px;
}

.rule-table__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.rule-table__source {
  font-size: 11px;
  color: var(--p-text-muted-color, #888);
}
</style>
