import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdvisorSession,
  getAdvisorSession,
  sendAdvisorMessage,
} from "../../../api/advisor";

export function useAdvisorSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["advisor", "session", sessionId],
    queryFn: () => getAdvisorSession(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useCreateAdvisorSession() {
  return useMutation({
    mutationFn: createAdvisorSession,
  });
}

export function useSendAdvisorMessage(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => sendAdvisorMessage(sessionId as string, message),
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({
          queryKey: ["advisor", "session", sessionId],
        });
      }
    },
  });
}
