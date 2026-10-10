import React from "react";
// Each primitive from its own file: the src/ui barrel pulls in react-router-dom, which these pages' tests can't load.
import { AppBar } from "../../../ui/AppBar";
import { BrandLogo } from "../../../ui/BrandLogo";
import "./GuestFrame.scss";

interface GuestFrameProps {
  /** The line over the title: the tournament. */
  eyebrow?: React.ReactNode;
  /** The court (or the match). Until it is known the bar carries just the wordmark. */
  title?: React.ReactNode;
  /** A narrower column (one match, a state card) instead of the court's list. */
  narrow?: boolean;
  children: React.ReactNode;
}

/**
 * The frame of the public pages scorekeepers open from printed QR codes (/venue/shared, /match/shared): the solid
 * blue bar of the tournament screens, with no back button (there is nowhere to go back to), over the page. One court
 * plays one match at a time, so the page is a single centred column, and the bar's content lines up with it.
 */
export function GuestFrame({ eyebrow, title, narrow = false, children }: GuestFrameProps): React.JSX.Element {
  return (
    <div className={`guest-frame${narrow ? " guest-frame--narrow" : ""}`}>
      <div className="guest-frame__bar">
        {title ? (
          <AppBar eyebrow={eyebrow || undefined} title={title} right={<BrandLogo />} />
        ) : (
          <header className="guest-frame__brand">
            <div className="guest-frame__brand-inner">
              <BrandLogo />
            </div>
          </header>
        )}
      </div>
      <main className="guest-frame__body">{children}</main>
    </div>
  );
}

export default GuestFrame;
