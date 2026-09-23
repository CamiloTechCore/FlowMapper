import { useSyncExternalStore } from 'react';
let messages = [];
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => messages;
function publish() { listeners.forEach(listener => listener()); }
function add(message, type = 'info', duration = 3500) {
  const id = crypto.randomUUID();
  messages = [...messages, { id, message, type }]; publish();
  setTimeout(() => { messages = messages.filter(item => item.id !== id); publish(); }, duration);
}
export function useToastProvider() { return { toasts: useSyncExternalStore(subscribe, snapshot), add }; }
export const toast = {
  info: message => add(message, 'info'), success: message => add(message, 'success'),
  error: message => add(message, 'error'), warn: message => add(message, 'warn'),
};
