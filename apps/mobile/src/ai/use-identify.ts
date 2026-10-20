import { isUsableSuggestion, type IdentifyResult } from '@plantpal/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, identifyPlant } from '@/api';
import { toUserMessage } from '@/errors/user-message';

import { aiLanguage, confirmAiNotice, prepareForAi } from './identify';

export type IdentifyState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  /** A usable answer: the form was pre-filled with it. */
  | { kind: 'suggested'; id: string; suggestion: IdentifyResult }
  /** Low confidence or not a plant: nothing pre-filled. */
  | { kind: 'unsure'; id: string; suggestion: IdentifyResult }
  | { kind: 'error'; message: string; offerUpgrade: boolean };

/**
 * Runs "Identify with AI" for one photo. Cancellable; a new photo or leaving the screen cancels
 * the call in flight, so a late answer can never overwrite what the user is doing now.
 * `onSuggestion` only receives answers good enough to pre-fill; the user still has to save.
 */
export function useIdentify(onSuggestion: (suggestion: IdentifyResult) => void) {
  const [state, setState] = useState<IdentifyState>({ kind: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setState({ kind: 'idle' });
  }, []);

  useEffect(() => () => inFlight.current?.abort(), []);

  const identify = useCallback(
    async (photoUri: string) => {
      if (!(await confirmAiNotice())) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setState({ kind: 'busy' });
      try {
        const image = await prepareForAi(photoUri);
        if (controller.signal.aborted) return;
        const { id, suggestion } = await identifyPlant(
          { image, language: aiLanguage() },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (isUsableSuggestion(suggestion)) {
          setState({ kind: 'suggested', id, suggestion });
          onSuggestion(suggestion);
        } else {
          setState({ kind: 'unsure', id, suggestion });
        }
      } catch (error) {
        if (controller.signal.aborted) return; // cancelled: cancel() already reset the state
        const limitOnFree =
          error instanceof ApiError &&
          error.code === 'identify_limit' &&
          error.details?.plan === 'free';
        setState({
          kind: 'error',
          message: toUserMessage(error, 'identify'),
          offerUpgrade: limitOnFree,
        });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [onSuggestion],
  );

  return { state, identify, cancel };
}
