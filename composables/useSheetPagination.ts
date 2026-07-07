import { onBeforeUnmount, onMounted, ref, watch, nextTick, type Ref } from 'vue';
import { paginate, type PageMetrics } from '@/utils/pagination';

/**
 * Keep section cards from straddling page breaks in the on-screen print
 * preview. After render (and on resize, font load, or content change) it
 * measures each card and pushes any that would cross a page break down to the
 * next page via a top margin. Layout math lives in the pure `paginate` helper.
 */
export function useSheetPagination(
  sheet: Ref<HTMLElement | null>,
  grid: Ref<HTMLElement | null>,
  metrics: () => PageMetrics,
  source: () => unknown,
) {
  const pageCount = ref(1);

  function apply() {
    const sheetEl = sheet.value;
    const gridEl = grid.value;
    if (!sheetEl || !gridEl) return;

    const cards = Array.from(gridEl.children) as HTMLElement[];
    // Reset so the next measurement reflects the natural (unpushed) layout.
    for (const card of cards) card.style.marginTop = '';

    const sheetTop = sheetEl.getBoundingClientRect().top;
    const boxes = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top - sheetTop, height: rect.height };
    });

    const layout = metrics();
    const offsets = paginate(boxes, layout);
    offsets.forEach((offset, index) => {
      if (offset > 0) cards[index].style.marginTop = `${offset}px`;
    });

    // How many printed pages the content now spans (for the page backdrop).
    // Measure the content's own extent (the lowest card after pushes), NOT the
    // sheet box — the box is inflated to whole pages via `min-height`, which
    // would otherwise pin the count and stop it shrinking when cards are hidden.
    const stride = layout.band + layout.gutter;
    let contentBottom = 0;
    for (const card of cards) {
      contentBottom = Math.max(contentBottom, card.getBoundingClientRect().bottom - sheetTop);
    }
    pageCount.value = Math.max(1, Math.ceil(contentBottom / stride));
  }

  const schedule = () => {
    void nextTick(apply);
  };

  onMounted(() => {
    schedule();
    window.addEventListener('resize', apply);
    void document.fonts?.ready?.then(apply);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', apply);
  });

  watch([source, metrics], schedule);

  return { apply, pageCount };
}
