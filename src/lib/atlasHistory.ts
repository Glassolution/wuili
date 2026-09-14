export type AtlasThreadSummary = {
  id: string;
  title: string;
  updated_at: string;
};

export const atlasThreadsQueryKey = (userId: string | null | undefined) => ["atlas-threads", userId];

export const atlasMessagesQueryKey = (threadId: string) => ["atlas-messages", threadId];
