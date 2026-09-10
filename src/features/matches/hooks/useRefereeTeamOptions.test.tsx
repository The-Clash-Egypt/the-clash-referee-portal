import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRefereeTeamOptions } from "./useRefereeTeamOptions";
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
