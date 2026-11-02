import { supabase } from '../lib/supabase';

const STORAGE_PREFIX = 'ares_chat_history_';

// Most recent messages kept when loading history (and therefore sent to the model as context)
const MAX_HISTORY_MESSAGES = 80;

const createDefaultGreeting = () => ({
  role: 'model',
  text: "EVA Online. I have full autonomous control over surface navigation, 2D/3D viewports, and mission systems, backed by Google's unrestricted world knowledge. I understand and speak all languages fluently — how can I assist you, Commander?",
  timestamp: new Date().toISOString()
});

/**
 * Load chat history for a user (or guest).
 * Prioritizes Supabase if user is logged in, with seamless localStorage fallback.
 */
export async function loadChatHistory(userId) {
  const localKey = `${STORAGE_PREFIX}${userId || 'guest'}`;
  
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY_MESSAGES);

      if (error) {
        console.warn("Supabase chat fetch fallback to localStorage:", error.message);
      } else if (data && data.length > 0) {
        const formatted = data.reverse().map(msg => ({
          id: msg.id,
          role: msg.role === 'model' ? 'model' : 'user',
          text: msg.content,
          actionData: msg.action_data,
          timestamp: msg.created_at
        }));
        // Cache to local storage
        try {
          localStorage.setItem(localKey, JSON.stringify(formatted));
        } catch (e) {
          console.warn("Could not cache chat history locally:", e);
        }
        return formatted;
      }
    } catch (err) {
      console.warn("Supabase chat fetch fallback to localStorage:", err);
    }
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(-MAX_HISTORY_MESSAGES);
      }
    }
  } catch (e) {
    console.error("Error reading localStorage chat history:", e);
  }

  return [createDefaultGreeting()];
}

/**
 * Persist a message to both localStorage and Supabase.
 */
export async function saveChatMessage({ userId, role, text, actionData = null }) {
  const localKey = `${STORAGE_PREFIX}${userId || 'guest'}`;
  const timestamp = new Date().toISOString();
  const newMsg = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${performance.now().toFixed(0)}`),
    role,
    text,
    actionData,
    timestamp
  };

  // 1. Immediately persist to localStorage for zero-latency UX
  try {
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const updated = [...existing, newMsg];
    // Keep last 100 messages locally
    localStorage.setItem(localKey, JSON.stringify(updated.slice(-100)));
  } catch (err) {
    console.error("Failed saving to localStorage:", err);
  }

  // 2. Persist to Supabase if authenticated
  if (userId) {
    try {
      const { error } = await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        role,
        content: text,
        action_data: actionData
      });
      if (error) throw error;
    } catch (err) {
      console.warn("Could not sync message to Supabase (run supabase_schema.sql if table missing):", err);
    }
  }

  return newMsg;
}

/**
 * Clear chat history for user or guest.
 */
export async function clearChatHistory(userId) {
  const localKey = `${STORAGE_PREFIX}${userId || 'guest'}`;
  try {
    localStorage.removeItem(localKey);
  } catch (e) {
    console.error(e);
  }

  if (userId) {
    try {
      const { error } = await supabase.from('ai_chat_messages').delete().eq('user_id', userId);
      if (error) throw error;
    } catch (err) {
      console.warn("Failed deleting chat messages from Supabase:", err);
    }
  }

  return [createDefaultGreeting()];
}
