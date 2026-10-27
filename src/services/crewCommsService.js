/**
 * Crew Comms Service
 * Manages inter-astronaut friendships, crew requests, real-time direct messaging,
 * and shared coordinates/telemetry via Supabase.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Searches for registered astronauts by callsign/username.
 */
export async function searchAstronauts(query, currentUserId) {
  if (!isSupabaseConfigured || !query || query.trim().length === 0) {
    return [];
  }

  const cleanQuery = query.trim().replace(/[%_]/g, '');
  if (!cleanQuery) return [];

  try {
    let q = supabase
      .from('profiles')
      .select('id, username, avatar_url, rank, total_distance_km, samples_collected')
      .ilike('username', `%${cleanQuery}%`)
      .limit(20);

    if (currentUserId) {
      q = q.neq('id', currentUserId);
    }

    const { data, error } = await q;
    if (error) {
      console.warn('CrewComms: searchAstronauts error:', error.message);
      return [];
    }
    return (data || []).filter((u) => !currentUserId || u.id !== currentUserId);
  } catch (err) {
    console.warn('CrewComms: searchAstronauts exception:', err);
    return [];
  }
}

/**
 * Retrieves all friend connections, incoming requests, and outgoing requests.
 */
export async function getFriendships(currentUserId) {
  if (!isSupabaseConfigured || !currentUserId) {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }

  // Purge any invalid legacy self-friendship rows
  supabase
    .from('friendships')
    .delete()
    .eq('user_id', currentUserId)
    .eq('friend_id', currentUserId)
    .then(() => {})
    .catch(() => {});

  try {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        updated_at,
        sender:profiles!friendships_user_id_fkey(id, username, avatar_url, rank),
        receiver:profiles!friendships_friend_id_fkey(id, username, avatar_url, rank)
      `)
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    if (error) {
      console.warn('CrewComms: getFriendships error:', error.message);
      return { friends: [], incomingRequests: [], outgoingRequests: [] };
    }

    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    (data || []).forEach((row) => {
      // Disallow self-friendships
      if (row.user_id === row.friend_id) return;

      const isSender = row.user_id === currentUserId;
      const otherUser = isSender ? row.receiver : row.sender;

      if (!otherUser || otherUser.id === currentUserId) return;

      const item = {
        friendshipId: row.id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isSender,
        user: otherUser,
      };

      if (row.status === 'accepted') {
        friends.push(item);
      } else if (row.status === 'pending') {
        if (isSender) {
          outgoingRequests.push(item);
        } else {
          incomingRequests.push(item);
        }
      }
    });

    return { friends, incomingRequests, outgoingRequests };
  } catch (err) {
    console.warn('CrewComms: getFriendships exception:', err);
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }
}

/**
 * Sends a friend request to another astronaut.
 */
export async function sendFriendRequest(currentUserId, targetUserId) {
  if (!isSupabaseConfigured || !currentUserId || !targetUserId) {
    return { error: new Error('Authentication or target missing') };
  }

  // Prevent self friend request
  if (currentUserId === targetUserId) {
    return { error: new Error('You cannot send a friend request to yourself.') };
  }

  try {
    // Check if an existing relationship already exists in either direction
    const { data: existing, error: checkError } = await supabase
      .from('friendships')
      .select('id, status, user_id, friend_id')
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
      )
      .maybeSingle();

    if (checkError) {
      console.warn('CrewComms: check friendship error:', checkError.message);
    }

    if (existing) {
      if (existing.status === 'accepted') {
        return { error: new Error('You are already crewmates with this astronaut.') };
      }
      if (existing.status === 'pending') {
        if (existing.user_id === currentUserId) {
          return { error: new Error('A friend request has already been sent to this astronaut.') };
        } else {
          // If the other user already sent us a request, auto-accept it!
          return respondToFriendRequest(existing.id, true);
        }
      }
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id: currentUserId,
        friend_id: targetUserId,
        status: 'pending',
      })
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Accepts or declines an incoming friend request.
 */
export async function respondToFriendRequest(friendshipId, accept) {
  if (!isSupabaseConfigured || !friendshipId) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    if (accept) {
      const { data, error } = await supabase
        .from('friendships')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', friendshipId)
        .select()
        .single();
      return { data, error };
    } else {
      // Rejecting/declining removes the pending request
      const { data, error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      return { data, error };
    }
  } catch (err) {
    return { error: err };
  }
}

/**
 * Removes a friendship.
 */
export async function removeFriend(friendshipId) {
  if (!isSupabaseConfigured || !friendshipId) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data, error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    return { data, error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Fetches direct messages between current user and a friend astronaut.
 */
export async function fetchDirectMessages(currentUserId, friendId, limit = 60) {
  if (!isSupabaseConfigured || !currentUserId || !friendId) {
    return { messages: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.warn('CrewComms: fetchDirectMessages error:', error.message);
      return { messages: [], error };
    }

    // Mark unread messages sent by friend to current user as read (non-blocking)
    supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', friendId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null)
      .then(() => {})
      .catch(() => {});

    return { messages: data || [], error: null };
  } catch (err) {
    console.warn('CrewComms: fetchDirectMessages exception:', err);
    return { messages: [], error: err };
  }
}

/**
 * Sends a direct message to a friend astronaut.
 * Supports actionData for transmitting coordinates, POIs, or routes.
 */
export async function sendDirectMessage(senderId, receiverId, content, actionData = null) {
  if (!isSupabaseConfigured || !senderId || !receiverId || !content?.trim()) {
    return { error: new Error('Message content or participants missing') };
  }

  if (senderId === receiverId) {
    return { error: new Error('Cannot send direct message to yourself.') };
  }

  try {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim(),
        action_data: actionData,
      })
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Gets total unread notifications count: unread messages + incoming pending friend requests.
 */
export async function getUnreadCommsCount(currentUserId) {
  if (!isSupabaseConfigured || !currentUserId) return 0;

  try {
    const [msgRes, reqRes] = await Promise.all([
      supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', currentUserId)
        .neq('sender_id', currentUserId)
        .is('read_at', null),
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', currentUserId)
        .neq('user_id', currentUserId)
        .eq('status', 'pending'),
    ]);

    const unreadMsgs = msgRes.count || 0;
    const pendingReqs = reqRes.count || 0;
    return unreadMsgs + pendingReqs;
  } catch (err) {
    console.warn('CrewComms: unread count exception:', err);
    return 0;
  }
}

/**
 * Realtime subscription listener for messages and friendship updates.
 */
export function subscribeToCrewComms(currentUserId, onEvent) {
  if (!isSupabaseConfigured || !currentUserId) {
    return () => {};
  }

  try {
    const channelName = `crew_comms_${currentUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const recId = payload.new?.receiver_id || payload.old?.receiver_id;
          const sndId = payload.new?.sender_id || payload.old?.sender_id;
          if (recId === currentUserId || sndId === currentUserId) {
            onEvent?.({ type: 'message', payload });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        (payload) => {
          const fid = payload.new?.friend_id || payload.old?.friend_id;
          const uid = payload.new?.user_id || payload.old?.user_id;
          if (fid === currentUserId || uid === currentUserId) {
            onEvent?.({ type: 'friendship', payload });
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  } catch (err) {
    console.warn('CrewComms: subscribe exception:', err);
    return () => {};
  }
}
