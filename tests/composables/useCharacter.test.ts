import { nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacter } from '@/composables/useCharacter';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import { CharacterFetchError } from '@/services/dndbeyond/fetch-character';
import { makeCharacter } from '../fixtures/character';

vi.mock('@/services/dndbeyond/load-character', () => ({
  loadCharacter: vi.fn(),
}));

const mockedLoad = vi.mocked(loadCharacter);

const sample = makeCharacter({
  id: 166869100,
  name: 'Noct',
  level: 4,
  classes: [{ name: 'Cleric', level: 4 }],
});

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

  it('clears a previously loaded character while reloading and after failure', async () => {
    let rejectReload!: (error: Error) => void;
    const reload = new Promise<typeof sample>((_resolve, reject) => {
      rejectReload = reject;
    });
    mockedLoad.mockResolvedValueOnce(sample).mockReturnValueOnce(reload);
    const id = ref<number | null>(1);
    const { character, status } = useCharacter(id);
    await flushPromises();
    expect(character.value?.name).toBe('Noct');

    id.value = 2;
    await nextTick();
    expect(status.value).toBe('loading');
    expect(character.value).toBeNull();
    rejectReload(new Error('boom'));
    await flushPromises();
    expect(status.value).toBe('error');
    expect(character.value).toBeNull();
  });

  it('uses a generic message when the failure is not an Error', async () => {
    mockedLoad.mockRejectedValue('kaboom');
    const { status, error } = useCharacter(ref(9));
    await flushPromises();

    expect(status.value).toBe('error');
    expect(error.value).toBe('Failed to load character.');
  });

  it.each([
    [401, 'session expired'],
    [403, 'session expired'],
    [404, 'Character not found'],
    [429, 'too many requests'],
    [503, 'temporarily unavailable'],
  ])('gives actionable guidance for HTTP %i', async (statusCode, message) => {
    mockedLoad.mockRejectedValue(new CharacterFetchError('raw error', statusCode));
    const { error } = useCharacter(ref(1));
    await flushPromises();

    expect(error.value).toContain(message);
    expect(error.value).not.toContain('raw error');
  });

  it('gives connection guidance for a network failure', async () => {
    mockedLoad.mockRejectedValue(new TypeError('Failed to fetch'));
    const { error } = useCharacter(ref(1));
    await flushPromises();

    expect(error.value).toContain('Could not reach D&D Beyond');
  });

  it('preserves a status-less service error message', async () => {
    mockedLoad.mockRejectedValue(new CharacterFetchError('Invalid response'));
    const { error } = useCharacter(ref(1));
    await flushPromises();

    expect(error.value).toBe('Invalid response');
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

  it('keeps the latest character when an older request resolves last', async () => {
    let resolveFirst!: (character: typeof sample) => void;
    let resolveSecond!: (character: typeof sample) => void;
    const first = new Promise<typeof sample>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<typeof sample>((resolve) => {
      resolveSecond = resolve;
    });
    mockedLoad.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const id = ref<number | null>(1);
    const { character } = useCharacter(id);

    await nextTick();
    id.value = 2;
    await nextTick();
    const firstSignal = mockedLoad.mock.calls[0][1]?.signal;
    expect(firstSignal?.aborted).toBe(true);

    const latest = { ...sample, id: 2, name: 'Latest' };
    resolveSecond(latest);
    await flushPromises();
    expect(character.value?.name).toBe('Latest');

    resolveFirst({ ...sample, id: 1, name: 'Stale' });
    await flushPromises();
    expect(character.value?.name).toBe('Latest');
  });

  it('ignores an older request that rejects after a newer character loads', async () => {
    let rejectFirst!: (error: Error) => void;
    const first = new Promise<typeof sample>((_resolve, reject) => {
      rejectFirst = reject;
    });
    mockedLoad
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ ...sample, id: 2, name: 'Latest' });
    const id = ref<number | null>(1);
    const { character, error, status } = useCharacter(id);

    await nextTick();
    id.value = 2;
    await flushPromises();
    rejectFirst(new Error('Stale failure'));
    await flushPromises();

    expect(character.value?.name).toBe('Latest');
    expect(status.value).toBe('loaded');
    expect(error.value).toBe('');
  });

  it('can retry the current character', async () => {
    mockedLoad.mockResolvedValue(sample);
    const { reload } = useCharacter(ref(1));
    await flushPromises();

    reload();
    await flushPromises();

    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });
});
