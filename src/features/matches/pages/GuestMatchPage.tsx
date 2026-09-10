import React from "react";
import { useSearchParams } from "react-router-dom";
import GuestMatchView from "./GuestMatchView";

/** Route /match/shared?matchId=&token= — the link a match QR encodes. */
const GuestMatchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  return <GuestMatchView matchId={searchParams.get("matchId") ?? ""} token={searchParams.get("token") ?? ""} />;
};

export default GuestMatchPage;
