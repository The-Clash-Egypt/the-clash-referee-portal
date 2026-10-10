import React from "react";
import heroCourts from "../assets/images/hero-courts.jpg";
import { BrushStrokes } from "./BrushStrokes";
import "./PhotoHeader.scss";

interface PhotoHeaderProps {
  /** Defaults to the court photo. */
  photo?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * The photo top of Log in and Tournaments (mockup `.ptop`): photo, dark scrim, blue and orange brush strokes in the
 * corner and a slanted bottom edge. The children sit on top in white.
 */
export function PhotoHeader({ photo = heroCourts, className, children }: PhotoHeaderProps): React.JSX.Element {
  return (
    <header className={["ui-ptop", className].filter(Boolean).join(" ")}>
      <img className="ui-ptop__photo" src={photo} alt="" decoding="async" />
      <div className="ui-ptop__scrim" aria-hidden="true" />
      <BrushStrokes variant="corner" className="ui-ptop__brush" />
      <div className="ui-ptop__content">{children}</div>
    </header>
  );
}

export default PhotoHeader;
