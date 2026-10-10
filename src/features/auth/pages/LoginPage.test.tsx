import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userReducer from "../../../store/slices/userSlice";
import { login } from "../api";
import LoginPage from "./LoginPage";

// Jest 27 (CRA) can't resolve react-router-dom v7; react-router exports the same API (it needs TextEncoder).
jest.mock(
  "react-router-dom",
  () => {
    const { TextEncoder, TextDecoder } = jest.requireActual("util");
    Object.assign(global, { TextEncoder, TextDecoder });
    return jest.requireActual("react-router");
  },
  { virtual: true }
);
jest.mock("../api", () => ({ login: jest.fn() }));

test.each(["admin", "referee"])("signing in as %s lands on the tournaments home", async (role) => {
  (login as jest.Mock).mockResolvedValue({
    data: { success: true, data: { token: "t0k3n", user: { id: "u1", firstName: "Karim", role, adminRoles: [] } } },
  });
  const store = configureStore({ reducer: { user: userReducer } });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Tournaments home</p>} />
          <Route path="/admin" element={<p>Old admin page</p>} />
          <Route path="/matches" element={<p>Old matches page</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "karim@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));

  expect(await screen.findByText("Tournaments home")).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith({ email: "karim@example.com", password: "secret123" });
  expect(store.getState().user.isAuthenticated).toBe(true);
});
