import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Icon } from "../../../ui/Icon";
import { useMediaQuery } from "../../../ui/useMediaQuery";
import { lockPageScroll, takeFocus } from "../layers";
import "./Drawer.scss";

export type DrawerSize = "md" | "lg";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A small action at the end of the header, before the close button (e.g. "Clear all", "Done"). */
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  /** md = 560px (forms, QR), lg = 960px (the bulk score sheet). Phones get a bottom sheet either way. */
  size?: DrawerSize;
  closeOnOverlayClick?: boolean;
  /** Scopes the dialog's own content styles, e.g. "assign-referee-drawer". */
  className?: string;
  children?: React.ReactNode;
}

/** How long the slide-out runs before the drawer unmounts — keep equal to $drawer-exit in Drawer.scss. */
export const DRAWER_EXIT_MS = 220;

/** Below this width every drawer opens as a bottom sheet. */
export const SHEET_QUERY = "(max-width: 767px)";

type Phase = "open" | "closing" | "closed";

interface Frame {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Every dialog in the portal opens as this drawer (user request 2026-09-10): a right-hand panel from 768px, and a
 * bottom sheet with a slanted top edge and a grab handle on phones (portal redesign 2026-10-10). It slides in and
 * out, closes on Escape / backdrop / ×, locks page scroll, and moves focus in and back. While sliding out it keeps
 * showing its last content, so a parent may clear its data at the same moment it closes the drawer.
 */
const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerAction,
  footer,
  size = "md",
  closeOnOverlayClick = true,
  className,
  children,
}) => {
  const [phase, setPhase] = useState<Phase>(isOpen ? "open" : "closed");
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFrame = useRef<Frame>({ title, subtitle, headerAction, footer, children });
  const titleId = useId();
  const asSheet = useMediaQuery(SHEET_QUERY);

  if (isOpen) lastFrame.current = { title, subtitle, headerAction, footer, children };

  useEffect(() => {
    if (isOpen) setPhase("open");
    else setPhase((current) => (current === "closed" ? "closed" : "closing"));
  }, [isOpen]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => setPhase("closed"), DRAWER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const mounted = phase !== "closed";

  // Scroll lock and focus hand-off span the whole time the drawer is on screen, slide-out included. Both are shared
  // with the other layers (../layers): a drawer often opens in the very render that closes another (the match sheet's
  // Score, Referee, QR code, Edit), and the two overlap while the first slides out.
  useEffect(() => {
    if (!mounted) return;
    const releaseScroll = lockPageScroll();
    const releaseFocus = takeFocus(panelRef.current);
    return () => {
      releaseScroll();
      releaseFocus();
    };
  }, [mounted]);

  useEffect(() => {
    if (phase !== "open") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [phase, onClose]);

  if (!mounted) return null;

  const frame = isOpen ? { title, subtitle, headerAction, footer, children } : lastFrame.current;
  const interactive = phase === "open";

  // While sliding out, the last content is frozen: `inert` takes it out of clicks, focus and the
  // accessibility tree (and the closing root has pointer-events: none).
  return createPortal(
    <div className={`drawer-root drawer-root--${phase}${asSheet ? " drawer-root--sheet" : ""}`}>
      <div
        className="drawer-overlay"
        aria-hidden="true"
        onClick={interactive && closeOnOverlayClick ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={`drawer drawer--${size}${asSheet ? " drawer--sheet" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        inert={phase === "closing"}
      >
        {asSheet ? <div className="drawer__handle" aria-hidden="true" /> : null}
        <header className="drawer__header">
          <div className="drawer__heading">
            <h2 id={titleId} className="drawer__title">
              {frame.title}
            </h2>
            {frame.subtitle ? <p className="drawer__subtitle">{frame.subtitle}</p> : null}
          </div>
          {frame.headerAction ? <div className="drawer__header-action">{frame.headerAction}</div> : null}
          <button type="button" className="drawer__close" onClick={interactive ? onClose : undefined} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="drawer__body">{frame.children}</div>
        {frame.footer ? <footer className="drawer__footer">{frame.footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
