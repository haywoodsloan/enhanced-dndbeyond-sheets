import { describe, expect, it } from 'vitest';
import { paginate, type PageMetrics } from '@/utils/pagination';

// Page 0 content area is [50, 950]; stride is 1020; usable height is 900.
const metrics: PageMetrics = { band: 1000, gutter: 20, margin: 50 };

describe('paginate', () => {
  it('leaves boxes that fit on a page unchanged', () => {
    const offsets = paginate(
      [
        { top: 50, height: 200 },
        { top: 260, height: 200 },
      ],
      metrics,
    );
    expect(offsets).toEqual([0, 0]);
  });

  it('pushes a box that would straddle a page break to the next page', () => {
    // 900..1050 crosses the page-0 content bottom (950).
    const offsets = paginate([{ top: 900, height: 150 }], metrics);
    // next content top = stride(1020) + margin(50) = 1070; delta = 1070 - 900.
    expect(offsets).toEqual([170]);
  });

  it('moves a whole row (boxes sharing a top) together', () => {
    const offsets = paginate(
      [
        { top: 900, height: 150 },
        { top: 900, height: 120 },
      ],
      metrics,
    );
    expect(offsets).toEqual([170, 170]);
  });

  it('accounts for earlier pushes when placing later boxes', () => {
    const offsets = paginate(
      [
        { top: 900, height: 150 }, // pushed down by 170
        { top: 1060, height: 100 }, // 1060 + 170 = 1230, fits on page 1
      ],
      metrics,
    );
    expect(offsets[0]).toBe(170);
    expect(offsets[1]).toBe(0);
  });

  it('leaves a box taller than a page in place', () => {
    const offsets = paginate([{ top: 50, height: 1200 }], metrics);
    expect(offsets).toEqual([0]);
  });
});
