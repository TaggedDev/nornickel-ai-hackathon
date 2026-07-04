import { ApiError } from "./auth";

export type ChatListResponse = {
  items: ChatListItemResponse[];
  nextSkip: number;
};

export type ChatListItemResponse = {
  id: string;
  title: string;
  isPinned: boolean;
  isOwnedByCurrentUser: boolean;
  lastActivityAtUtc: string;
  createdAtUtc: string;
};

export type ChatDetailsResponse = ChatListItemResponse & {
  messages: ChatMessageResponse[];
  nextMessagesBeforeUtc: string | null;
  knowledgeContext: ChatKnowledgeContextResponse | null;
};

export type ChatMessageResponse = {
  id: string;
  sender: string;
  text: string;
  createdAtUtc: string;
};

export type ChatKnowledgeContextResponse = {
  graph: {
    nodes: KnowledgeGraphNodeResponse[];
    edges: KnowledgeGraphEdgeResponse[];
  };
  documents: ReferencedDocumentResponse[];
  representedNodeIds: string[];
  search: ChatKnowledgeSearchMetaResponse | null;
};

export type ChatKnowledgeSearchMetaResponse = {
  query: string;
  intent: string;
  retrievedFacts: number;
  usedFacts: number;
  model: string | null;
  noData: boolean;
};

export type KnowledgeGraphNodeResponse = {
  id: string;
  type: string;
  label: string;
  canonicalName: string;
  aliases: string[];
  properties: Record<string, unknown>;
};

export type KnowledgeGraphEdgeResponse = {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
};

export type ReferencedDocumentResponse = {
  citationId: number;
  id: string;
  title: string;
  snippet: string;
  section: string | null;
  page: number | null;
  confidence: number;
  geo: string | null;
  year: number | null;
  language: string | null;
  downloadUrl: string;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const problem = payload as { title?: string; detail?: string; errors?: Record<string, string[]> } | null;
  throw new ApiError(problem?.title ?? problem?.detail ?? `Request failed with status ${response.status}`, response.status, problem?.errors);
}

export async function getChats(take = 50): Promise<ChatListResponse> {
  const params = new URLSearchParams({ take: String(take) });
  const response = await fetch(`/api/chats?${params.toString()}`, {
    credentials: "include",
  });

  return parseApiResponse<ChatListResponse>(response);
}

export async function getChat(chatId: string): Promise<ChatDetailsResponse> {
  const response = await fetch(`/api/chats/${chatId}`, {
    credentials: "include",
  });

  return parseApiResponse<ChatDetailsResponse>(response);
}

export async function createChat(message: string): Promise<ChatDetailsResponse> {
  const response = await fetch("/api/chats", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return parseApiResponse<ChatDetailsResponse>(response);
}

export async function addChatMessage(chatId: string, message: string): Promise<ChatDetailsResponse> {
  const response = await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return parseApiResponse<ChatDetailsResponse>(response);
}
