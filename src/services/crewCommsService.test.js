import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crewCommsService from './crewCommsService';

describe('crewCommsService', () => {
  it('returns empty array when searching with empty query or unconfigured', async () => {
    const results = await crewCommsService.searchAstronauts('', 'user-123');
    expect(results).toEqual([]);
  });

  it('prevents sending a friend request to oneself', async () => {
    const result = await crewCommsService.sendFriendRequest('user-123', 'user-123');
    expect(result.error).toBeDefined();
    expect(result.error.message).toMatch(/cannot send a friend request to yourself/i);
  });

  it('prevents sending a direct message to oneself', async () => {
    const result = await crewCommsService.sendDirectMessage('user-123', 'user-123', 'hello');
    expect(result.error).toBeDefined();
    expect(result.error.message).toMatch(/cannot send direct message to yourself/i);
  });

  it('handles null user id safely in getFriendships', async () => {
    const data = await crewCommsService.getFriendships(null);
    expect(data).toEqual({ friends: [], incomingRequests: [], outgoingRequests: [] });
  });

  it('handles unread comms count gracefully with missing user', async () => {
    const count = await crewCommsService.getUnreadCommsCount(null);
    expect(count).toBe(0);
  });

  it('returns noop un-subscriber when subscribing without user', () => {
    const unsub = crewCommsService.subscribeToCrewComms(null, () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('handles null friendship id safely in removeFriend', async () => {
    const result = await crewCommsService.removeFriend(null);
    expect(result.error).toBeDefined();
  });

  it('handles null friendship id safely in respondToFriendRequest', async () => {
    const result = await crewCommsService.respondToFriendRequest(null, false);
    expect(result.error).toBeDefined();
  });
});
