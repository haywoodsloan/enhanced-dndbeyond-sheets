import { ref, watch, type Ref } from 'vue';
import type { Character } from '@/services/dndbeyond/model';
import { loadCharacter } from '@/services/dndbeyond/load-character';
import { debugLog } from '@/utils/debug';

export type CharacterStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseCharacter {
  character: Ref<Character | null>;
  status: Ref<CharacterStatus>;
  error: Ref<string>;
}

/**
 * Reactive wrapper around {@link loadCharacter}: exposes the character plus
 * loading and error state, and (re)loads whenever the id changes.
 */
export function useCharacter(characterId: Ref<number | null>): UseCharacter {
  const character = ref<Character | null>(null);
  const status = ref<CharacterStatus>('idle');
  const error = ref('');

  watch(
    characterId,
    async (id) => {
      if (id == null) {
        debugLog('sheet', 'useCharacter: no character id');
        return;
      }
      status.value = 'loading';
      error.value = '';
      try {
        character.value = await loadCharacter(id);
        status.value = 'loaded';
        debugLog('sheet', 'useCharacter: loaded', { id });
      } catch (cause) {
        error.value =
          cause instanceof Error ? cause.message : 'Failed to load character.';
        status.value = 'error';
        debugLog('sheet', 'useCharacter: failed', { id, error: error.value });
      }
    },
    { immediate: true },
  );

  return { character, status, error };
}
