import { useRef, useCallback } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Touch long-press → context menu. Returns pointer handlers to spread onto an element;
 * `onLongPress(x, y)` fires after the hold, and the click that follows is swallowed.
 */
export default function useLongPress(onLongPress) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse') return;
    firedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    const { clientX, clientY } = e;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress(clientX, clientY);
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const onPointerMove = useCallback((e) => {
    if (!timerRef.current || !startRef.current) return;
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancel();
  }, [cancel]);

  const onClickCapture = useCallback((e) => {
    if (firedRef.current) {
      firedRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture
  };
}
