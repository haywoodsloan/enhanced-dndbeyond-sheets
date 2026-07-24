import { ref, watch, type Ref } from 'vue';
import type { Character } from '@/services/dndbeyond/model';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import { CharacterFetchError } from '@/services/dndbeyond/fetch-character';
import { debugLog } from '@/utils/debug';

export type CharacterStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseCharacter {
  character: Ref<Character | null>;
  status: Ref<CharacterStatus>;
  error: Ref<string>;
  reload: () => void;
}

function characterLoadMessage(cause: unknown): string {
  if (cause instanceof CharacterFetchError) {
    if (cause.status === 401 || cause.status === 403) {
      return 'Your D&D Beyond session expired. Refresh your character page on D&D Beyond, then try again.';
    }
    if (cause.status === 404) {
      return 'Character not found. Check that it still exists and that your account can access it.';
    }
    if (cause.status === 429) {
      return 'D&D Beyond is receiving too many requests. Wait a moment, then try again.';
    }
    if (cause.status != null && cause.status >= 500) {
      return 'D&D Beyond is temporarily unavailable. Try again in a moment.';
    }
  }
  if (cause instanceof TypeError) {
    return 'Could not reach D&D Beyond. Check your connection, then try again.';
  }
  return cause instanceof Error ? cause.message : 'Failed to load character.';
}

/**
 * Reactive wrapper around {@link loadCharacter}: exposes the character plus
 * loading and error state, and (re)loads whenever the id changes.
 */
export function useCharacter(characterId: Ref<number | null>): UseCharacter {
  const character = ref<Character | null>(null);
  const status = ref<CharacterStatus>('idle');
  const error = ref('');
  const reloadVersion = ref(0);

  watch(
    () => [characterId.value, reloadVersion.value] as const,
    async ([id], _previous, onCleanup) => {
      if (id == null) {
        character.value = null;
        status.value = 'idle';
        error.value = '';
        debugLog('sheet', 'useCharacter: no character id');
        return;
      }
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      character.value = null;
      status.value = 'loading';
      error.value = '';
      try {
        const loaded = await loadCharacter(id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        character.value = loaded;
        status.value = 'loaded';
        debugLog('sheet', 'useCharacter: loaded', { id });
      } catch (cause) {
        if (controller.signal.aborted) return;
        character.value = null;
        error.value = characterLoadMessage(cause);
        status.value = 'error';
        debugLog('sheet', 'useCharacter: failed', { id, error: error.value });
      }
    },
    { immediate: true },
  );

  return {
    character,
    status,
    error,
    reload: () => {
      reloadVersion.value += 1;
    },
  };
}
