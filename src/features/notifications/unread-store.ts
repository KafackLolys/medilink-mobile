import { create } from 'zustand';
import { useNavigationSession } from '@/store/navigation-session';
import { notificationsApi } from '@/services/notifications';
import { parseNotificationPage } from './notification-model';

/**
 * The server owns the unread total. No local count is invented from the
 * first page, the Android status bar, or a push payload.
 */
type UnreadState = { count: number | null; revision: number };
export const useUnreadNotifications = create<UnreadState>(() => ({ count: null, revision: 0 }));

export function publishUnreadCount(value: number) {
  if (Number.isSafeInteger(value) && value >= 0) {
    useUnreadNotifications.setState({ count: value });
  }
}

export function resetUnreadNotifications() {
  useUnreadNotifications.setState(state => ({ count: null, revision: state.revision + 1 }));
}

export async function refreshUnreadNotifications(): Promise<void> {
  const snapshot = useNavigationSession.getState().session;
  const generation = useUnreadNotifications.getState().revision;
  if (snapshot.status !== 'authenticated' || (snapshot.role !== 'patient' && snapshot.role !== 'doctor')) {
    resetUnreadNotifications();
    return;
  }
  try {
    const raw = await notificationsApi.list(1, 1);
    const page = parseNotificationPage(raw);
    if (generation === useUnreadNotifications.getState().revision &&
        useNavigationSession.getState().session === snapshot) {
      publishUnreadCount(page.unreadCount);
    }
  } catch {
    // A network error cannot turn a known unread count into a fabricated zero.
  }
}
