import { supabase } from '../lib/supabase';
import useMapStore from '../store/useMapStore';

/** Loads the signed-in user's profile row into the store. Safe to call repeatedly. */
export async function fetchProfile(userId) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) useMapStore.getState().setProfile(data);
  } catch (e) {
    console.warn("Could not fetch profile:", e);
  }
}
