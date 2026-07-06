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
  // Images load after first render and change card heights; re-measure on load.
  const wiredImages = new WeakSet<HTMLImageElement>();

  function wireImages(gridEl: HTMLElement) {
    for (const img of Array.from(gridEl.querySelectorAll('img'))) {
      if (img.complete || wiredImages.has(img)) continue;
      wiredImages.add(img);
      img.addEventListener('load', apply, { once: true });
      img.addEventListener('error', apply, { once: true });
    }
  }

  function apply() {
    const sheetEl = sheet.value;
    const gridEl = grid.value;
    if (!sheetEl || !gridEl) return;

    wireImages(gridEl);

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
    const stride = layout.band + layout.gutter;
    const height = sheetEl.getBoundingClientRect().height;
    pageCount.value = Math.max(1, Math.ceil(height / stride));
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
