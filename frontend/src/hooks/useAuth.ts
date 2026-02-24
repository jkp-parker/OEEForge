import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: isAuthenticated(),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isOperator: user?.role === "operator",
    error,
  };
}
