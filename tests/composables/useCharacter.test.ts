import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacter } from '@/composables/useCharacter';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import type { Character } from '@/services/dndbeyond/model';

vi.mock('@/services/dndbeyond/load-character', () => ({
  loadCharacter: vi.fn(),
}));

const mockedLoad = vi.mocked(loadCharacter);

const sample: Character = {
  id: 166869100,
  name: 'Noct',
  level: 4,
  classes: [{ name: 'Cleric', level: 4 }],
  abilities: [],
  basics: {
    armorClass: 10,
    initiative: 0,
    speed: 30,
    proficiencyBonus: 2,
    hitPoints: { current: 10, max: 10, temp: 0 },
    conditions: [],
  },
  savingThrows: [],
  sections: [],
};

describe('useCharacter', () => {
  beforeEach(() => {
    mockedLoad.mockReset();
  });

  it('loads the character when an id is provided', async () => {
    mockedLoad.mockResolvedValue(sample);
    const { character, status } = useCharacter(ref(166869100));

    expect(status.value).toBe('loading');
    await flushPromises();
    expect(status.value).toBe('loaded');
    expect(character.value?.name).toBe('Noct');
  });

  it('stays idle and does not load without an id', async () => {
    const { status } = useCharacter(ref(null));
    await flushPromises();

    expect(status.value).toBe('idle');
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('reports an error when loading fails', async () => {
    mockedLoad.mockRejectedValue(new Error('boom'));
    const { status, error } = useCharacter(ref(5));
    await flushPromises();

    expect(status.value).toBe('error');
    expect(error.value).toBe('boom');
  });

  it('reloads when the id changes', async () => {
    mockedLoad.mockResolvedValue(sample);
    const id = ref<number | null>(1);
    useCharacter(id);
    await flushPromises();
    expect(mockedLoad).toHaveBeenCalledTimes(1);

    id.value = 2;
    await flushPromises();
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });
});
