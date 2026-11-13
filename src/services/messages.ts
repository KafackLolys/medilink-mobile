import { apiRequest } from './http';
import type { Conversation, ConversationMessage } from '@/types/domain';
const path = (id: string) => '/messages/conversations/' + encodeURIComponent(id);
export const messagesApi = {
  list: (signal?: AbortSignal) => apiRequest<{ items: Conversation[] }>('/messages/conversations', { signal }),
  messages: (id: string, signal?: AbortSignal) => apiRequest<{ items: ConversationMessage[] }>(path(id), { signal }),
  send: (id: string, body: string, signal?: AbortSignal) =>
    apiRequest<ConversationMessage>(path(id), { method: 'POST', body: { body }, signal }),
};
