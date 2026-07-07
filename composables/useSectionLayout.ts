import { onMounted, ref, watch, type Ref } from 'vue';
import type { Character, CharacterSection, SectionKey } from '@/services/dndbeyond/model';
import { applySavedOrder, defaultSectionOrder, moveSectionKey } from '@/utils/section-order';
import { sectionOrderPref } from '@/utils/preferences';

/**
 * Reactive section layout for the sheet. Starts from the class-aware default
 * order, applies the user's saved order (loaded from local storage), and
 * exposes `moveSection` to drag-reorder cards — which persists the new order.
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

  /** Move the `source` card into `target`'s slot, then persist the new order. */
  function moveSection(source: SectionKey, target: SectionKey) {
    const keys = moveSectionKey(
      sections.value.map((section) => section.key),
      source,
      target,
    );
    const byKey = new Map(sections.value.map((section) => [section.key, section]));
    sections.value = keys
      .map((key) => byKey.get(key))
      .filter((section): section is CharacterSection => section !== undefined);
    savedOrder.value = keys;
    void sectionOrderPref.set(keys);
  }

  return { sections, moveSection };
}
