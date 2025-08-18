import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  gender?: string;
  birthdate?: string;
  phoneNumber?: string;
  accountType: string;
  photo?: string;
  emailVerified: boolean;
  role: "referee" | "player" | "representer" | "admin";
  nationality?: string;
  instagramAccount?: string;
  tshirtSize?: string;
  playerId?: string;
}

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: UserState = {
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem("token", action.payload);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
    initializeUser: (state) => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          state.user = JSON.parse(storedUser);
        } catch (error) {
          console.error("Error parsing stored user:", error);
          localStorage.removeItem("user");
        }
      }
    },
  },
});

export const { setUser, setToken, logout, initializeUser } = userSlice.actions;
export default userSlice.reducer;
