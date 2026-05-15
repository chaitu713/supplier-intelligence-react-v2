import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdvisorSession,
  deleteAdvisorSession,
  getAdvisorSession,
  sendAdvisorMessage,
  type SendAdvisorMessagePayload,
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

export function useDeleteAdvisorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdvisorSession,
    onSuccess: async (_data, sessionId) => {
      await queryClient.removeQueries({
        queryKey: ["advisor", "session", sessionId],
      });
    },
  });
}

export function useSendAdvisorMessage(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SendAdvisorMessagePayload) =>
      sendAdvisorMessage(sessionId as string, payload),
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({
          queryKey: ["advisor", "session", sessionId],
        });
      }
    },
  });
}
