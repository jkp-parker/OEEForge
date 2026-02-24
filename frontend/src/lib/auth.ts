import { authApi, type User } from "./api";

export async function login(username: string, password: string): Promise<User> {
  const res = await authApi.login(username, password);
  localStorage.setItem("access_token", res.data.access_token);
  const meRes = await authApi.me();
  return meRes.data;
}

export function logout() {
  localStorage.removeItem("access_token");
  window.location.href = "/login";
}

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
