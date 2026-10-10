import { act, renderHook } from "@testing-library/react";
import { useSelection } from "./useSelection";

const ids = ["m1", "m2", "m3"];
const sorted = (set: Set<string>) => Array.from(set).sort();

it("starts select mode with the long-pressed match selected", () => {
  const { result } = renderHook(() => useSelection(ids));
  expect(result.current.active).toBe(false);
  expect(result.current.selected.size).toBe(0);

  act(() => result.current.start("m2"));

  expect(result.current.active).toBe(true);
  expect(sorted(result.current.selected)).toEqual(["m2"]);
});

it("starts empty from the Select button, then toggles and selects all", () => {
  const { result } = renderHook(() => useSelection(ids));

  act(() => result.current.start());
  expect(result.current.active).toBe(true);
  expect(result.current.selected.size).toBe(0);

  act(() => result.current.toggle("m1"));
  expect(sorted(result.current.selected)).toEqual(["m1"]);
  act(() => result.current.toggle("m1"));
  expect(result.current.selected.size).toBe(0);

  act(() => result.current.selectAll());
  expect(sorted(result.current.selected)).toEqual(["m1", "m2", "m3"]);
});

it("clear empties the selection but stays in select mode; exit leaves it", () => {
  const { result } = renderHook(() => useSelection(ids));
  act(() => result.current.start("m1"));
  act(() => result.current.toggle("m3"));

  act(() => result.current.clear());
  expect(result.current.active).toBe(true);
  expect(result.current.selected.size).toBe(0);

  act(() => result.current.selectAll());
  act(() => result.current.exit());
  expect(result.current.active).toBe(false);
  expect(result.current.selected.size).toBe(0);
});

it("deselect drops only the given matches", () => {
  const { result } = renderHook(() => useSelection(ids));
  act(() => result.current.start());
  act(() => result.current.selectAll());

  act(() => result.current.deselect(["m1", "m3"]));

  expect(sorted(result.current.selected)).toEqual(["m2"]);
});

it("only counts matches that are still in the list", () => {
  const { result, rerender } = renderHook(({ list }) => useSelection(list), { initialProps: { list: ids } });
  act(() => result.current.start());
  act(() => result.current.selectAll());

  rerender({ list: ["m1", "m3"] });

  expect(sorted(result.current.selected)).toEqual(["m1", "m3"]);
});
