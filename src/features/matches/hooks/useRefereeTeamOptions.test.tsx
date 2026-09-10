import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forgetRefereeTeamOptions, useRefereeTeamOptions } from "./useRefereeTeamOptions";
import { getRefereeTeamOptions } from "../api/refereeTeams";

jest.mock("../../../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../api/refereeTeams", () => ({ getRefereeTeamOptions: jest.fn() }));

const load = getRefereeTeamOptions as jest.Mock;
const options = [{ teamId: "t1", teamName: "Falcons", categoryName: "Men's Open", eligibleMatchIds: ["m1"] }];

// The app's client caches for 5 minutes by default; the hook must still refetch on every open.
const clientLikeTheApp = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false } } });

const wrapperFor =
  (client: QueryClient): React.FC<{ children: React.ReactNode }> =>
  ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => load.mockResolvedValue(options));

it("loads the teams for the drawer's matches", async () => {
  const { result } = renderHook(() => useRefereeTeamOptions(["m1", "m2"], true), { wrapper: wrapperFor(clientLikeTheApp()) });

  await waitFor(() => expect(result.current.data).toEqual(options));
  expect(load).toHaveBeenCalledWith(["m1", "m2"]);
});

it("stays idle while the drawer is closed or has no matches", () => {
  const wrapper = wrapperFor(clientLikeTheApp());
  renderHook(() => useRefereeTeamOptions(["m1"], false), { wrapper });
  renderHook(() => useRefereeTeamOptions([], true), { wrapper });

  expect(load).not.toHaveBeenCalled();
});

it("asks again each time the drawer reopens, so assignments made meanwhile show", async () => {
  // Read both fields during render: React Query only re-renders for the fields it saw being used.
  const { result, rerender } = renderHook(
    ({ open }) => {
      const { data, isFetching } = useRefereeTeamOptions(["m1"], open);
      return { data, isFetching };
    },
    { initialProps: { open: true }, wrapper: wrapperFor(clientLikeTheApp()) }
  );
  await waitFor(() => expect(result.current.data).toEqual(options));

  rerender({ open: false });
  rerender({ open: true });

  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.isFetching).toBe(false));
});

// Read the fields during render: React Query only re-renders for the fields it saw being used.
const useOptionsProbe = ({ open }: { open: boolean }) => {
  const { data, isLoading, isFetching } = useRefereeTeamOptions(["m1"], open);
  return { data, isLoading, isFetching };
};

it("after an assignment change, a reopened drawer waits for the new list instead of showing the old one", async () => {
  const client = clientLikeTheApp();
  const { result, rerender } = renderHook(useOptionsProbe, { initialProps: { open: true }, wrapper: wrapperFor(client) });
  await waitFor(() => expect(result.current.data).toEqual(options));

  rerender({ open: false });
  act(() => {
    void forgetRefereeTeamOptions(client);
  });
  const fresh = [{ ...options[0], teamId: "t2", teamName: "Waves" }];
  load.mockResolvedValue(fresh);
  rerender({ open: true });

  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(result.current.data).toEqual(fresh));
});

it("after an assignment change, an open drawer reloads its list with the loading state", async () => {
  const client = clientLikeTheApp();
  const { result } = renderHook(useOptionsProbe, { initialProps: { open: true }, wrapper: wrapperFor(client) });
  await waitFor(() => expect(result.current.data).toEqual(options));

  const fresh = [{ ...options[0], teamId: "t2", teamName: "Waves" }];
  let answer: (teams: typeof fresh) => void = () => undefined;
  load.mockReturnValue(new Promise((resolve) => (answer = resolve)));
  act(() => {
    void forgetRefereeTeamOptions(client);
  });

  await waitFor(() => expect(result.current.isLoading).toBe(true));
  expect(result.current.data).toBeUndefined();
  act(() => answer(fresh));
  await waitFor(() => expect(result.current.data).toEqual(fresh));
  expect(load).toHaveBeenCalledTimes(2);
});
