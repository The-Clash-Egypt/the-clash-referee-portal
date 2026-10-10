/**
 * What every layer over the page (a drawer, the scoreboard) does while it is on screen: hold the page still, take the
 * keyboard focus, and give both back when it goes. Layers overlap: the match sheet slides out while the sheet or the
 * scoreboard that its Score, Referee, QR code or Edit opened comes in. So each layer can't simply save what it found
 * and restore it later: the page lock is counted, and focus is handed on from one layer to the next.
 */

let holds = 0;
let pageOverflow = "";

/**
 * Holds the page still. The page scrolls again (body's overflow back to what it was before the first hold) once the
 * last hold is released. Returns the release; releasing twice is harmless.
 */
export function lockPageScroll(): () => void {
  if (holds === 0) {
    pageOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0) document.body.style.overflow = pageOverflow;
  };
}

/** Where focus goes back to when each layer on screen closes. */
const focusReturns = new WeakMap<Element, { target: HTMLElement | null }>();

const canTakeFocus = (element: HTMLElement | null): element is HTMLElement =>
  !!element && element.isConnected && element !== document.body;

const layerHolding = (element: Element): { target: HTMLElement | null } | undefined => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const entry = focusReturns.get(node);
    if (entry) return entry;
  }
  return undefined;
};

/**
 * Moves focus into `layer` and returns the hand-back for when it goes: focus returns to where it came from, but only
 * while it is still in the layer (or nowhere). If it has moved on to a layer opened in this one's place, it stays
 * there, and that layer returns it to where this one would have (its own way back was inside this one).
 */
export function takeFocus(layer: HTMLElement | null): () => void {
  const focusReturn = { target: document.activeElement as HTMLElement | null };
  if (layer) focusReturns.set(layer, focusReturn);
  layer?.focus();
  return () => {
    const active = document.activeElement;
    if (!active || active === document.body || layer?.contains(active)) {
      if (canTakeFocus(focusReturn.target)) focusReturn.target.focus();
      return;
    }
    const next = layerHolding(active);
    if (next && (!canTakeFocus(next.target) || layer?.contains(next.target))) next.target = focusReturn.target;
  };
}
