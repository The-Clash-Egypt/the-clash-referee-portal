import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState } from "../../ui";
import "./NotFound.scss";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <main className="not-found-page">
      <EmptyState
        icon="alert"
        title="404 - Page Not Found"
        action={
          <Button icon="back" onClick={() => navigate("/")}>
            Back home
          </Button>
        }
      />
    </main>
  );
};

export default NotFoundPage;
