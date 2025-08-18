export interface AuthResponse {
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    gender?: string;
    birthdate?: string;
    phoneNumber: string;
  };
}

export interface AuthError {
  message: string;
  field?: string;
}
