import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Outlet, useLocation, useMatch, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RootState } from "../../store";
import { AppBar, BrandLogo, TabBar } from "../../ui";
import type { IconName, TabItem } from "../../ui";
import { hasFullAccess } from "../auth/permissions";
import { getMexicanoStages } from "../mexicano/api/mexicano";
import { useTournamentInfo } from "./useTournamentInfo";
import { AppBarSlotProvider } from "./AppBarSlot";
import "./TournamentLayout.scss";

type TabKey = "matches" | "courts" | "mexicano" | "more";

const TABS: Record<TabKey, { label: string; icon: IconName }> = {
  matches: { label: "Matches", icon: "matches" },
  courts: { label: "Courts", icon: "courts" },
  mexicano: { label: "Mexicano", icon: "mexicano" },
  more: { label: "More", icon: "more" },
};

const isTabKey = (value: string | undefined): value is TabKey =>
  !!value && Object.prototype.hasOwnProperty.call(TABS, value);

/**
 * The frame of a tournament's screens: the blue app bar (back to the tournaments, "Sport · Tab", the tournament's
 * name, the logo) and the section tabs — a bottom bar on phones, a nav inside the app bar from 900px.
 * Matches and More are for everyone; Courts only with full access; Mexicano only when the tournament has a stage.
 */
const TournamentLayout: React.FC = () => {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.user);
  const info = useTournamentInfo(id);
  const tabMatch = useMatch({ path: "/tournaments/:id/:tab", end: false });
  // Where a tab puts its own controls (AppBarSlot): the matches search and filters under the title, for one; and
  // while it takes the frame over (select mode), its own bar and bottom bar in place of the app bar and the tabs.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  const [bottomSlot, setBottomSlot] = useState<HTMLDivElement | null>(null);
  const [takeover, setTakeover] = useState(false);
  const slots = useMemo(
    () => ({ below: slot, bar: barSlot, bottom: bottomSlot, setTakeover }),
    [slot, barSlot, bottomSlot]
  );

  const { data: stages } = useQuery({
    queryKey: ["mexicano-stages", id],
    queryFn: () => getMexicanoStages(id),
    enabled: !!id && !!user,
  });

  const keys: TabKey[] = [
    "matches",
    ...(hasFullAccess(user) ? (["courts"] as const) : []),
    ...((stages?.length ?? 0) > 0 ? (["mexicano"] as const) : []),
    "more",
  ];
  // Every tab keeps the query string (?name= and any filters) so moving between tabs loses nothing.
  const items: TabItem[] = keys.map((key) => ({
    to: `/tournaments/${id}/${key}${search}`,
    label: TABS[key].label,
    icon: TABS[key].icon,
  }));

  const current = tabMatch?.params.tab;
  const eyebrow = [info.sport, isTabKey(current) ? TABS[current].label : undefined].filter(Boolean).join(" · ");

  // A tab opens at its top, not at the scroll position of the tab before it.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [current]);

  return (
    <div className={`tournament-layout${takeover ? " tournament-layout--takeover" : ""}`}>
      <div className="tournament-layout__bar">
        <div ref={setBarSlot} className="tournament-layout__takeover" />
        <div hidden={takeover}>
          <AppBar
            eyebrow={eyebrow || undefined}
            title={info.name}
            onBack={() => navigate("/")}
            backLabel="Back to tournaments"
            right={<BrandLogo />}
          >
            <div ref={setSlot} className="tournament-layout__slot" />
            <div className="tournament-layout__topnav">
              <TabBar items={items} placement="top" />
            </div>
          </AppBar>
        </div>
      </div>

      <main className="tournament-layout__content">
        <AppBarSlotProvider value={slots}>
          <Outlet />
        </AppBarSlotProvider>
      </main>

      <div hidden={takeover}>
        <TabBar items={items} placement="bottom" />
      </div>
      <div ref={setBottomSlot} className="tournament-layout__takeover" />
    </div>
  );
};

export default TournamentLayout;
