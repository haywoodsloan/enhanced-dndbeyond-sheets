import { onMounted, ref, watch, type Ref } from 'vue';
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import {
  applySavedOrder,
  defaultSectionOrder,
  moveSectionByIndex,
} from '@/utils/section-order';
import { sectionOrderPref } from '@/utils/preferences';

/**
 * Reactive section layout for the sheet. Starts from the class-aware default
 * order, applies the user's saved order (loaded from local storage), and
 * exposes `moveByIndex` to drag-reorder cards — which persists the new order.
 */
export function useSectionLayout(character: Ref<Character | null>) {
  const sections = ref<CharacterSection[]>([]);
  const savedOrder = ref<SectionKey[]>([]);

  function rebuild() {
    sections.value = character.value
      ? applySavedOrder(defaultSectionOrder(character.value), savedOrder.value)
      : [];
  }

  onMounted(async () => {
    savedOrder.value = await sectionOrderPref.get([]);
    rebuild();
  });
  watch(character, rebuild);

  /** Move the card at `from` to index `to`, then persist the new order. */
  function moveByIndex(from: number, to: number) {
    const next = moveSectionByIndex(sections.value, from, to);
    if (next === sections.value) return;
    sections.value = next;
    const keys = next.map((section) => section.key);
    savedOrder.value = keys;
    void sectionOrderPref.set(keys);
  }

  return { sections, moveByIndex };
}
