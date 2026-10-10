import React, { useEffect, useId, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { Icon } from "../../../ui";
import { useLogout } from "../../auth/useLogout";
import "./AccountMenu.scss";

/** The initials avatar on the Tournaments photo top; it opens a small panel with the user's name and Log out. */
const AccountMenu: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Close on a tap outside or Escape (focus goes back to the avatar).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const initials = `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div className="account-menu" ref={root}>
      <button
        ref={toggle}
        type="button"
        className="account-menu__avatar"
        aria-label={`Account: ${fullName}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span aria-hidden="true">{initials || <Icon name="person" size={16} />}</span>
      </button>
      <div className="account-menu__panel" id={panelId} hidden={!open}>
        <div className="account-menu__card">
          <p className="account-menu__name">{fullName}</p>
          <button type="button" className="account-menu__item" onClick={logout}>
            <span className="account-menu__icon" aria-hidden="true">
              <Icon name="logout" size={16} />
            </span>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;
