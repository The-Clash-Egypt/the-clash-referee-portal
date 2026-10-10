import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LONG_PRESS_MS, RELEASE_GRACE_MS, useLongPress } from "./useLongPress";

const Row: React.FC<{ onLongPress: () => void; onClick: () => void }> = ({ onLongPress, onClick }) => {
  const press = useLongPress(onLongPress);
  return (
    <button type="button" onClick={onClick} {...press}>
      Row
    </button>
  );
};

afterEach(() => jest.useRealTimers());

const setup = () => {
  jest.useFakeTimers();
  const onLongPress = jest.fn();
  const onClick = jest.fn();
  render(<Row onLongPress={onLongPress} onClick={onClick} />);
  return { row: screen.getByRole("button", { name: "Row" }), onLongPress, onClick };
};

const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

// Review M3: the release click used to get through after a hold of about 2 s, un-ticking the row just selected.
test("swallows the click that ends a long press, however long the hold", () => {
  const { row, onLongPress, onClick } = setup();

  fireEvent.pointerDown(row);
  wait(LONG_PRESS_MS);
  expect(onLongPress).toHaveBeenCalledTimes(1);

  wait(4000); // still holding
  fireEvent.pointerUp(row);
  fireEvent.click(row);
  expect(onClick).not.toHaveBeenCalled();
});

test("lets the next tap through once the long press has been released", () => {
  const { row, onClick } = setup();

  fireEvent.pointerDown(row);
  wait(LONG_PRESS_MS);
  fireEvent.pointerUp(row);
  wait(RELEASE_GRACE_MS); // no click came with the release (a phone may send none)

  fireEvent.click(row);
  expect(onClick).toHaveBeenCalledTimes(1);
});

// Review part 2, M4: on touch screens the release's click can come in a later task than the pointerup.
test("still swallows the release's click when it comes a moment after the finger lifts", () => {
  const { row, onClick } = setup();

  fireEvent.pointerDown(row);
  wait(LONG_PRESS_MS);
  fireEvent.pointerUp(row);
  wait(300);
  fireEvent.click(row);
  expect(onClick).not.toHaveBeenCalled();

  // ...and the next real tap (which starts with its own press) goes through.
  fireEvent.pointerDown(row);
  fireEvent.pointerUp(row);
  fireEvent.click(row);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("a new press disarms it at once", () => {
  const { row, onClick } = setup();

  fireEvent.pointerDown(row);
  wait(LONG_PRESS_MS);
  fireEvent.pointerDown(row);
  fireEvent.pointerUp(row);
  fireEvent.click(row);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("a short tap is a click, not a long press", () => {
  const { row, onLongPress, onClick } = setup();

  fireEvent.pointerDown(row);
  wait(LONG_PRESS_MS - 100);
  fireEvent.pointerUp(row);
  fireEvent.click(row);
  wait(LONG_PRESS_MS);
  expect(onLongPress).not.toHaveBeenCalled();
  expect(onClick).toHaveBeenCalledTimes(1);
});
