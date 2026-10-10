import { act, renderHook } from "@testing-library/react";
import { useForcedLandscape } from "./useForcedLandscape";

const STORAGE_KEY = "portal.scoreboard.landscape";

/** jsdom has no matchMedia: report the viewport as portrait or landscape. */
const stubOrientation = (portrait: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(orientation: portrait)" ? portrait : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
  delete (window as unknown as Record<string, unknown>).matchMedia;
});

test("toggling on is remembered on this device, so the next scoreboard starts sideways", () => {
  stubOrientation(true);
  const { result } = renderHook(() => useForcedLandscape());
  expect(result.current.forced).toBe(false);

  act(() => result.current.toggle());

  expect(result.current.forced).toBe(true);
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  expect(renderHook(() => useForcedLandscape()).result.current.forced).toBe(true);
});

test("still switches when the browser refuses storage (private mode)", () => {
  stubOrientation(true);
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  const { result } = renderHook(() => useForcedLandscape());
  expect(result.current.forced).toBe(false);

  act(() => result.current.toggle());

  expect(result.current.forced).toBe(true);
  expect(result.current.rotate).toBe(true);
});

test("never rotates a viewport that is already landscape, even when forced", () => {
  stubOrientation(false);
  window.localStorage.setItem(STORAGE_KEY, "1");

  const { result } = renderHook(() => useForcedLandscape());

  expect(result.current.forced).toBe(true);
  expect(result.current.viewportPortrait).toBe(false);
  expect(result.current.rotate).toBe(false);
});
