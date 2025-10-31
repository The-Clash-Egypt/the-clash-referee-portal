import api from "../../../api/axios";
import { AdminRole } from "../types/adminRoles";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserDto {
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
  adminRoles?: AdminRole[];
  nationality?: string;
  instagramAccount?: string;
  tshirtSize?: string;
  playerId?: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ServiceResponse<T> {
  data: T;
  success: boolean;
  message: string;
  errors: ValidationError[];
}

export const login = (data: LoginRequest): Promise<{ data: ServiceResponse<AuthResponseDto> }> =>
  api.post("auth/login", data);

export const signup = (data: any, invitationToken?: string): Promise<any> => {
  const payload = invitationToken ? { ...data, invitationToken } : data;
  return api.post("auth/signup", payload);
};

export const getCurrentUser = (): Promise<{ data: ServiceResponse<UserDto> }> => api.get("auth/me");
