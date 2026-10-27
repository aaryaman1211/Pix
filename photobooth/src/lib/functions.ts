import { supabase } from '@/lib/supabase';

// Calls an edge function and throws with the function's own { error } message on failure.
export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return data as T;

  // On a non-2xx reply supabase-js puts the raw Response on `context`. Duck-type it: React Native's
  // Response isn't always the global one, so `instanceof Response` can fail.
  const res = (error as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;
  let message: string | undefined;
  try {
    const text = await res?.text?.();
    if (text) {
      try {
        message = (JSON.parse(text) as { error?: string }).error ?? text;
      } catch {
        message = text;
      }
    }
  } catch {}
  throw new Error(message || error.message);
}
