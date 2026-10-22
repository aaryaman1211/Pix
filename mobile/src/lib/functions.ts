import { supabase } from '@/lib/supabase';

// Calls an edge function and throws with the function's own { error } message on failure.
export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return data as T;

  const res = (error as { context?: unknown }).context;
  if (res instanceof Response) {
    try {
      const json = await res.json();
      if (json?.error) throw new Error(json.error);
    } catch (err) {
      if (err instanceof Error && err.message) throw err;
    }
  }
  throw new Error(error.message);
}
