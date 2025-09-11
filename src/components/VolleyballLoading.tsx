import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolleyball } from "@fortawesome/free-solid-svg-icons";
import "./VolleyballLoading.scss";

interface VolleyballLoadingProps {
  message?: string;
  size?: "small" | "medium" | "large";
}

const VolleyballLoading: React.FC<VolleyballLoadingProps> = ({ message = "Loading matches...", size = "medium" }) => {
  return (
    <div className={`volleyball-loading ${size}`}>
      <div className="volleyball-container">
        <div className="volleyball">
          <FontAwesomeIcon icon={faVolleyball} className="volleyball-icon" />
        </div>
        <div className="shadow"></div>
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default VolleyballLoading;
