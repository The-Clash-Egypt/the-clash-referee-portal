import React, { useCallback, useEffect, useRef } from "react";

/** How long a finger (or the mouse button) rests on a row before select mode starts. */
export const LONG_PRESS_MS = 500;

/** A finger that moves this far is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

/**
 * The click that ends a long-press (mouse up, or a lifted finger on some phones) must not also open or toggle the
 * row: the row under the pointer has just been swapped for its select-mode version, so that click is swallowed at the
 * window, whatever element it lands on. Only a click with no new press before it: the next real tap goes through.
 */
const swallowTrailingClick = () => {
  let timeout = 0;
  function disarm() {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", disarm, true);
    window.clearTimeout(timeout);
  }
  function swallow(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    disarm();
  }
  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", disarm, true);
  timeout = window.setTimeout(disarm, 1500);
};

type LongPressHandlers = Pick<
  React.DOMAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave" | "onContextMenu"
>;

/**
 * Pointer handlers that call `onLongPress` after a 500 ms hold without moving. Without a callback there are no
 * handlers (a plain referee's rows only open on a tap). The browser's own long-press menu is held back.
 */
export function useLongPress(onLongPress: (() => void) | undefined, ms: number = LONG_PRESS_MS): LongPressHandlers {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  if (!onLongPress) return {};

  return {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      cancel();
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        origin.current = null;
        swallowTrailingClick();
        onLongPress();
      }, ms);
    },
    onPointerMove: (event) => {
      const start = origin.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (event) => event.preventDefault(),
  };
}

export default useLongPress;
