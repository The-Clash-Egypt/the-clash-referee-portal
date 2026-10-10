import React from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { RootState } from "../../store";
import { Icon } from "../../ui";
import { useLogout } from "../auth/useLogout";
import "./MorePage.scss";

/** The More tab (mockup rest-of-portal.html phone 4): everything that isn't courtside. */
const MorePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const logout = useLogout();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <div className="more-page">
      <section className="more-page__section" aria-labelledby="more-page-account">
        <h2 className="more-page__heading" id="more-page-account">
          <span className="more-page__blade" aria-hidden="true" />
          Account
        </h2>
        <ul className="more-page__menu">
          <li>
            <Link to="/" className="more-page__row">
              <span className="more-page__icon" aria-hidden="true">
                <Icon name="switch" size={16} />
              </span>
              <span className="more-page__text">Switch tournament</span>
              <Icon name="chevron-right" size={14} className="more-page__chevron" />
            </Link>
          </li>
          <li>
            <button type="button" className="more-page__row" onClick={logout}>
              <span className="more-page__icon" aria-hidden="true">
                <Icon name="logout" size={16} />
              </span>
              <span className="more-page__text">
                Log out
                {fullName ? <small className="more-page__sub">{fullName}</small> : null}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default MorePage;
