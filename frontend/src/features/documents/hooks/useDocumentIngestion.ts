import { useMutation, useQuery } from "@tanstack/react-query";

import {
  createIngestionJob,
  getDocumentHistory,
  getIngestionJob,
  getUploadUrl,
  uploadDocumentToStorage,
  type DocumentHistoryItem,
  type DocumentKind,
  type IngestionJob,
} from "../../../api/documents";

export interface StartIngestionInput {
  supplierFile: File;
  esgFile: File;
  transactionFile: File;
}

async function startDocumentIngestion(
  input: StartIngestionInput,
): Promise<IngestionJob> {
  const uploadRequests = [
    { file: input.supplierFile, documentKind: "supplier" as const },
    { file: input.esgFile, documentKind: "esg" as const },
    { file: input.transactionFile, documentKind: "transaction" as const },
  ];

  const uploadConfigs = await Promise.all(
    uploadRequests.map(({ file, documentKind }) =>
      getUploadUrl({
        fileName: file.name,
        documentKind,
        contentType: file.type || "application/pdf",
      }),
    ),
  );

  await Promise.all(
    uploadRequests.map(async ({ file }, index) =>
      uploadDocumentToStorage(file, uploadConfigs[index]),
    ),
  );

  return createIngestionJob({
    files: uploadConfigs.map((config) => ({
      fileName: config.fileName,
      documentKind: config.documentKind,
      blobKey: config.blobKey,
    })),
  });
}

export function useStartDocumentIngestion() {
  return useMutation({
    mutationFn: startDocumentIngestion,
  });
}

export function useIngestionJob(jobId: string | null) {
  return useQuery({
    queryKey: ["documents", "ingestion-job", jobId],
    queryFn: () => getIngestionJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return 3000;
      }

      return data.status === "completed" || data.status === "failed" ? false : 3000;
    },
  });
}

export function useDocumentHistory() {
  return useQuery<DocumentHistoryItem[]>({
    queryKey: ["documents", "history"],
    queryFn: getDocumentHistory,
  });
}
