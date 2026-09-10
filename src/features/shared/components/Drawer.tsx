import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./Drawer.scss";

export type DrawerSize = "md" | "lg";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  /** md = 560px (forms, QR), lg = 960px (the bulk score sheet). Both take the full width on phones. */
  size?: DrawerSize;
  closeOnOverlayClick?: boolean;
  /** Scopes the dialog's own content styles, e.g. "assign-referee-drawer". */
  className?: string;
  children?: React.ReactNode;
}

/** How long the slide-out runs before the drawer unmounts — keep equal to $drawer-exit in Drawer.scss. */
export const DRAWER_EXIT_MS = 220;

type Phase = "open" | "closing" | "closed";

interface Frame {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Every dialog in the portal opens as this right-side drawer (user request 2026-09-10): it slides in
 * and out, takes the full width on phones, closes on Escape / backdrop / ×, locks page scroll, and
 * moves focus in and back. While sliding out it keeps showing its last content, so a parent may
 * clear its data at the same moment it closes the drawer.
 */
const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  size = "md",
  closeOnOverlayClick = true,
  className,
  children,
}) => {
  const [phase, setPhase] = useState<Phase>(isOpen ? "open" : "closed");
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFrame = useRef<Frame>({ title, subtitle, footer, children });
  const titleId = useId();

  if (isOpen) lastFrame.current = { title, subtitle, footer, children };

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

  // Scroll lock and focus hand-off span the whole time the drawer is on screen, slide-out included.
  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
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

  const frame = isOpen ? { title, subtitle, footer, children } : lastFrame.current;
  const interactive = phase === "open";

  // While sliding out, the last content is frozen: `inert` takes it out of clicks, focus and the
  // accessibility tree (and the closing root has pointer-events: none).
  return createPortal(
    <div className={`drawer-root drawer-root--${phase}`}>
      <div
        className="drawer-overlay"
        aria-hidden="true"
        onClick={interactive && closeOnOverlayClick ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={`drawer drawer--${size}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        inert={phase === "closing"}
      >
        <header className="drawer__header">
          <div className="drawer__heading">
            <h2 id={titleId} className="drawer__title">
              {frame.title}
            </h2>
            {frame.subtitle ? <p className="drawer__subtitle">{frame.subtitle}</p> : null}
          </div>
          <button type="button" className="drawer__close" onClick={interactive ? onClose : undefined} aria-label="Close">
            ×
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
