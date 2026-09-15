import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { api, ApiError } from "./api";
import { useAuth } from "./auth";

export function useApi<T>(
  path: string,
  schema: z.ZodType<T>,
  enabled = true,
  interval?: number,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [user?.tenant_id, user?.user_id, path],
    enabled: !!user && enabled,
    queryFn: ({ signal }) => api(path, schema, { signal }),
    staleTime: 15000,
    refetchInterval: interval,
    retry: (count, error) =>
      count < 1 &&
      (!(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500),
    retryDelay: 1000,
  });
}
