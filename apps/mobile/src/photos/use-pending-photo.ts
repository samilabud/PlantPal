import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { recoverPendingPhoto, type CapturedPhoto } from './capture';

/**
 * Recovers a photo the camera or crop screen returned while Android had closed PlantPal's
 * activity (see `recoverPendingPhoto`). Checks when the screen opens and whenever the app comes
 * back to the front. Android only: other platforms have no pending results.
 */
export function usePendingPhoto(onPhoto: (photo: CapturedPhoto) => void, enabled = true) {
  // The latest callback, without re-subscribing on every render.
  const latest = useRef(onPhoto);
  useEffect(() => {
    latest.current = onPhoto;
  });

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    let mounted = true;
    const check = () =>
      recoverPendingPhoto()
        .then((photo) => {
          if (photo && mounted) latest.current(photo);
        })
        .catch(() => undefined); // a broken pending result is not worth an error on screen
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [enabled]);
}
