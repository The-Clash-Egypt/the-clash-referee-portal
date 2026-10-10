import { render, screen, act, fireEvent } from "@testing-library/react";
import { Button, Segmented, Chip, ToastProvider, useToast, SearchInput, Icon, useMediaQuery } from ".";

// The barrel re-exports TabBar (NavLink). Jest can't resolve react-router-dom v7 (its "main" file is missing; CRA's
// Jest 27 ignores "exports"), so stand in for it here; none of these tests render a NavLink.
jest.mock("react-router-dom", () => ({ NavLink: () => null }), { virtual: true });

test("Button with loading is disabled and busy", () => {
  render(<Button loading>Save</Button>);
  const b = screen.getByRole("button", { name: /save/i });
  expect(b).toBeDisabled();
  expect(b).toHaveAttribute("aria-busy", "true");
});

test("Segmented marks the active tab and reports changes", () => {
  const onChange = jest.fn();
  render(<Segmented ariaLabel="Status" value="live" onChange={onChange}
    options={[{ value: "live", label: "Live", count: 3 }, { value: "next", label: "Up next", count: 12 }]} />);
  expect(screen.getByRole("tab", { name: /live/i })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("tab", { name: /up next/i }));
  expect(onChange).toHaveBeenCalledWith("next");
});

test("Chip remove button is labelled and fires", () => {
  const onRemove = jest.fn();
  render(<Chip selected onRemove={onRemove}>Court 1</Chip>);
  fireEvent.click(screen.getByRole("button", { name: "Remove Court 1" }));
  expect(onRemove).toHaveBeenCalled();
});

test("toast shows and hides", () => {
  jest.useFakeTimers();
  const Shower = () => { const { show } = useToast(); return <button onClick={() => show("Score saved.", { tone: "ok", durationMs: 1000 })}>go</button>; };
  render(<ToastProvider><Shower /></ToastProvider>);
  fireEvent.click(screen.getByText("go"));
  expect(screen.getByRole("status")).toHaveTextContent("Score saved.");
  act(() => { jest.advanceTimersByTime(1500); });
  expect(screen.queryByText("Score saved.")).toBeNull();
  jest.useRealTimers();
});

test("Chip reports its selection with aria-pressed", () => {
  render(<><Chip selected>Sat 12</Chip><Chip>Sun 13</Chip></>);
  expect(screen.getByRole("button", { name: "Sat 12" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Sun 13" })).toHaveAttribute("aria-pressed", "false");
});

test("SearchInput offers a clear button only when it has text", () => {
  const onChange = jest.fn();
  const { rerender } = render(<SearchInput value="" onChange={onChange} placeholder="Team, player or court" />);
  expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "Team, player or court" }), { target: { value: "sand" } });
  expect(onChange).toHaveBeenCalledWith("sand");

  rerender(<SearchInput value="sand" onChange={onChange} placeholder="Team, player or court" />);
  fireEvent.click(screen.getByRole("button", { name: /clear/i }));
  expect(onChange).toHaveBeenLastCalledWith("");
});

test("Icon is hidden from assistive tech unless it has a title", () => {
  const { container } = render(<><Icon name="search" /><Icon name="qr" title="QR code" /></>);
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the decorative icon has no role
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByRole("img", { name: "QR code" })).toBeInTheDocument();
});

test("useMediaQuery is false where matchMedia is missing (Jest)", () => {
  const Probe = () => <span>{useMediaQuery("(max-width: 767px)") ? "phone" : "wide"}</span>;
  render(<Probe />);
  expect(screen.getByText("wide")).toBeInTheDocument();
});
