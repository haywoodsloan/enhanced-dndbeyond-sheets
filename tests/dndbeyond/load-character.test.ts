import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCharacter } from '@/services/dndbeyond/load-character';

const noctData = JSON.parse(readFileSync('tests/fixtures/noct.json', 'utf-8'));

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

describe('loadCharacter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes a character', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ id: noctData.id, success: true, message: null, data: noctData }),
      ),
    );

    const character = await loadCharacter(166869100);

    expect(character.name).toBe('Noct');
    expect(character.classes).toEqual([
      { name: 'Cleric', level: 4, subclass: 'Grave Domain' },
    ]);
    expect(character.sections.map((section) => section.key)).toEqual([
      'attributes',
      'attacks',
      'spells',
      'inventory',
      'features',
    ]);
  });

  it('propagates fetch failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(null, { ok: false, status: 404 })),
    );

    await expect(loadCharacter(1)).rejects.toThrow();
  });
});
