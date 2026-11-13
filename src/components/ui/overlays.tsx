import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal as NativeModal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Modal({ visible, title, description, children, onClose, onConfirm, confirmLabel = 'Confirmer', busy = false }: {
  visible: boolean; title: string; description?: string; children?: ReactNode;
  onClose: () => void; onConfirm?: () => void; confirmLabel?: string; busy?: boolean;
}) {
  const theme = useTheme();
  return (
    <NativeModal transparent animationType="fade" visible={visible} onRequestClose={onClose}
      statusBarTranslucent accessibilityViewIsModal>
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View style={styles.modalDialog}>
          <Card>
            <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
            {description ? <ThemedText themeColor="textSecondary">{description}</ThemedText> : null}
            {children}
            <View style={styles.actions}>
              <Button label="Annuler" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
              {onConfirm ? <Button label={confirmLabel} onPress={onConfirm} loading={busy} style={{ flex: 1 }} /> : null}
            </View>
          </Card>
        </View>
      </View>
    </NativeModal>
  );
}

type ToastTone = 'success' | 'error' | 'info';
type ToastData = { message: string; tone: ToastTone };
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const theme = useTheme();
  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.toastContainer}>
          <Pressable accessibilityRole="button" accessibilityLabel={toast.message + '. Fermer la notification'}
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderLeftColor:
              toast.tone === 'error' ? theme.danger : toast.tone === 'success' ? theme.success : theme.primary }]}>
            <ThemedText style={{ flex: 1 }}>{toast.message}</ThemedText>
            <ThemedText themeColor="primary" type="smallBold">Fermer</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans ToastProvider.');
  return context;
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  modalDialog: { width: '100%', maxWidth: 480 },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  toastContainer: { position: 'absolute', top: 16, left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', maxWidth: 480, width: '100%',
    borderWidth: 1, borderLeftWidth: 4, padding: Spacing.three, borderRadius: Radius.large,
    elevation: 8 },
});
