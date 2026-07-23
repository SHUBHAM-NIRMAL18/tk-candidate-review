export interface ToastData {
  title: string;
  message: string;
  type?: 'success' | 'error';
}

const TOAST_KEY = 'tk_pending_toast';

export function triggerToast(title: string, message: string, type: 'success' | 'error' = 'success') {
  sessionStorage.setItem(TOAST_KEY, JSON.stringify({ title, message, type }));
}

export function consumeToast(): ToastData | null {
  const dataStr = sessionStorage.getItem(TOAST_KEY);
  if (!dataStr) return null;
  
  sessionStorage.removeItem(TOAST_KEY);
  try {
    return JSON.parse(dataStr) as ToastData;
  } catch {
    return null;
  }
}
