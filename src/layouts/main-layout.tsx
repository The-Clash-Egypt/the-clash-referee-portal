// src/layouts/MainLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";

const MainLayout: React.FC = () => {
  return (
    <div className="app-container">
      {/* Shared header/navigation */}
      <header>
        <h1>My App</h1>
        <nav>
          <a href="/">Home</a> | <a href="/about">About</a>
        </nav>
      </header>

      {/* Page-specific content */}
      <main>
        <Outlet />
      </main>

      {/* Shared footer */}
      <footer>
        <p>© {new Date().getFullYear()} My App</p>
      </footer>
    </div>
  );
};

export default MainLayout;
