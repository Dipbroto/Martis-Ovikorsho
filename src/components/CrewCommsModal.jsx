import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Users,
  UserPlus,
  Send,
  X,
  ShieldCheck,
  MapPin,
  Search,
  Check,
  Trash2,
  MessageSquare,
  RefreshCw,
  Copy,
  Clock,
  Sparkles,
  Compass,
} from 'lucide-react';
import useMapStore from '../store/useMapStore';
import {
  searchAstronauts,
  getFriendships,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  fetchDirectMessages,
  sendDirectMessage,
  subscribeToCrewComms,
} from '../services/crewCommsService';
import { marsAudio } from '../utils/audioSynthesizer';

export default function CrewCommsModal() {
  const isCrewCommsOpen = useMapStore((s) => s.isCrewCommsOpen);
  const setCrewCommsOpen = useMapStore((s) => s.setCrewCommsOpen);
  const user = useMapStore((s) => s.user);
  const profile = useMapStore((s) => s.profile);
  const activeCommsFriend = useMapStore((s) => s.activeCommsFriend);
  const setActiveCommsFriend = useMapStore((s) => s.setActiveCommsFriend);
  const setUnreadCommsCount = useMapStore((s) => s.setUnreadCommsCount);
  const mapCenter = useMapStore((s) => s.mapCenter);
  const setMapCenter = useMapStore((s) => s.setMapCenter);
  const setMapZoom = useMapStore((s) => s.setMapZoom);

  // Directory sub-tab: 'friends' | 'search' | 'requests'
  const [activeTab, setActiveTab] = useState('friends');

  // Friendship data
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionFeedback, setActionFeedback] = useState({});

  // Direct chat state
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [shareCoords, setShareCoords] = useState(false);
  const [copiedCallsign, setCopiedCallsign] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load friends and requests
  const loadDirectory = async () => {
    if (!user) return;
    setIsLoadingDirectory(true);
    try {
      const data = await getFriendships(user.id);
      setFriends(data.friends || []);
      setIncomingRequests(data.incomingRequests || []);
      setOutgoingRequests(data.outgoingRequests || []);
      setUnreadCommsCount((data.incomingRequests?.length || 0));
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  useEffect(() => {
    if (isCrewCommsOpen && user) {
      loadDirectory();
    }
  }, [isCrewCommsOpen, user]);

  // Realtime subscription for incoming messages & friend updates
  useEffect(() => {
    if (!user) return;

    const unsub = subscribeToCrewComms(user.id, (event) => {
      if (event.type === 'message') {
        const newMsg = event.payload.new;
        if (
          activeCommsFriend &&
          (newMsg?.sender_id === activeCommsFriend.id ||
            newMsg?.receiver_id === activeCommsFriend.id)
        ) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          marsAudio.playQuindarTone?.(false);
        }
      } else if (event.type === 'friendship') {
        loadDirectory();
        marsAudio.playQuindarTone?.(true);
      }
    });

    return () => unsub();
  }, [user, activeCommsFriend]);

  // Load chat messages when activeCommsFriend changes
  useEffect(() => {
    if (!user || !activeCommsFriend) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);
    fetchDirectMessages(user.id, activeCommsFriend.id).then(({ messages: msgs }) => {
      if (isMounted) {
        setMessages(msgs || []);
        setIsLoadingMessages(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, activeCommsFriend]);

  // Handle Search
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchAstronauts(searchQuery, user?.id);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Send Friend Request
  const handleSendRequest = async (targetUser) => {
    marsAudio.playUiClick?.();
    setActionFeedback((prev) => ({ ...prev, [targetUser.id]: 'sending' }));
    const { error } = await sendFriendRequest(user.id, targetUser.id);
    if (error) {
      setActionFeedback((prev) => ({ ...prev, [targetUser.id]: error.message }));
    } else {
      setActionFeedback((prev) => ({ ...prev, [targetUser.id]: 'sent' }));
      loadDirectory();
    }
  };

  // Handle Accept / Decline Request
  const handleRespondRequest = async (friendshipId, accept) => {
    marsAudio.playUiClick?.();
    await respondToFriendRequest(friendshipId, accept);
    await loadDirectory();
  };

  // Handle Remove Friend
  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm('Disconnect this astronaut from your direct communications relay?')) return;
    marsAudio.playUiClick?.();
    await removeFriend(friendshipId);
    if (activeCommsFriend) {
      setActiveCommsFriend(null);
    }
    await loadDirectory();
  };

  // Handle Transmit Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeCommsFriend || !user || isTransmitting) return;

    const content = messageInput.trim();
    setMessageInput('');
    setIsTransmitting(true);

    let actionData = null;
    if (shareCoords && mapCenter) {
      actionData = {
        type: 'coordinates',
        lat: Number(mapCenter[0].toFixed(4)),
        lon: Number(mapCenter[1].toFixed(4)),
        label: `Mars Coordinate (${mapCenter[0].toFixed(2)}°, ${mapCenter[1].toFixed(2)}°)`,
      };
      setShareCoords(false);
    }

    marsAudio.playQuindarTone?.(true);

    const { data: sentMsg, error } = await sendDirectMessage(
      user.id,
      activeCommsFriend.id,
      content,
      actionData
    );

    if (sentMsg) {
      setMessages((prev) => [...prev, sentMsg]);
    }
    setIsTransmitting(false);
  };

  // Teleport Map to shared coordinates
  const handleTeleportToCoords = (coords) => {
    if (!coords || coords.lat == null || coords.lon == null) return;
    marsAudio.playQuindarTone?.(true);
    setMapCenter([coords.lat, coords.lon]);
    setMapZoom(7);
    setCrewCommsOpen(false);
  };

  // Copy own callsign
  const handleCopyCallsign = () => {
    const callsign = profile?.username || 'Explorer';
    navigator.clipboard?.writeText(callsign);
    setCopiedCallsign(true);
    setTimeout(() => setCopiedCallsign(false), 2000);
  };

  if (!isCrewCommsOpen || !user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[750] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setCrewCommsOpen(false)}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl h-[88vh] max-h-[780px] bg-[#0B0C10]/95 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-stone-200 z-10"
        >
          {/* Top Status & Header Bar */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-space-950/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-900/30">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-black tracking-widest text-white uppercase">
                    DSN Crew Comms
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-ping"></span>
                    INTER-ASTRONAUT RELAY
                  </span>
                </div>
                <div className="text-[11px] font-mono text-stone-400 flex items-center gap-2">
                  <span>Callsign:</span>
                  <span className="text-white font-bold">{profile?.username || 'Explorer'}</span>
                  <button
                    onClick={handleCopyCallsign}
                    className="hover:text-cyan-400 text-stone-500 transition-colors flex items-center gap-0.5"
                    title="Copy your callsign to share with crewmates"
                  >
                    {copiedCallsign ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span className="text-[10px]">{copiedCallsign ? 'Copied' : 'Share'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDirectory}
                disabled={isLoadingDirectory}
                className="p-1.5 rounded-lg border border-white/10 text-stone-400 hover:text-white hover:bg-white/5 transition-all"
                title="Refresh Crew Telemetry"
              >
                <RefreshCw size={14} className={isLoadingDirectory ? 'animate-spin text-cyan-400' : ''} />
              </button>
              <button
                onClick={() => setCrewCommsOpen(false)}
                className="p-1.5 rounded-lg border border-white/10 text-stone-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 transition-all"
                title="Close Comms"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Body: Left Directory (320px) + Right Direct Chat (flex-1) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Astronaut Directory & Navigation */}
            <div className="w-full md:w-80 border-r border-white/10 flex flex-col bg-space-950/40 shrink-0 h-full">
              {/* Directory Sub-Tabs */}
              <div className="flex border-b border-white/10 p-2 gap-1 bg-space-900/40 shrink-0">
                <button
                  onClick={() => {
                    marsAudio.playUiClick?.();
                    setActiveTab('friends');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'friends'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                  }`}
                >
                  <Users size={13} />
                  <span>Crew ({friends.length})</span>
                </button>

                <button
                  onClick={() => {
                    marsAudio.playUiClick?.();
                    setActiveTab('search');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-mono text-xs flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'search'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                  }`}
                >
                  <UserPlus size={13} />
                  <span>Add Crew</span>
                </button>

                <button
                  onClick={() => {
                    marsAudio.playUiClick?.();
                    setActiveTab('requests');
                  }}
                  className={`py-1.5 px-2.5 rounded-lg font-mono text-xs flex items-center justify-center gap-1 transition-all relative ${
                    activeTab === 'requests'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                  }`}
                  title="Incoming and Outgoing Requests"
                >
                  <Clock size={13} />
                  {incomingRequests.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center">
                      {incomingRequests.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Directory Content Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar-y p-3 space-y-2">
                {/* 1. CREW FRIENDS LIST */}
                {activeTab === 'friends' && (
                  <div className="space-y-1.5">
                    {friends.length === 0 ? (
                      <div className="py-8 text-center text-stone-500 text-xs font-mono px-4">
                        <Users className="w-8 h-8 mx-auto text-stone-600 mb-2 opacity-50" />
                        <p>No crewmates connected yet.</p>
                        <button
                          onClick={() => setActiveTab('search')}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 text-xs transition-all inline-flex items-center gap-1.5"
                        >
                          <UserPlus size={12} />
                          <span>Search Callsigns</span>
                        </button>
                      </div>
                    ) : (
                      friends.filter((item) => item.user && item.user.id !== user?.id).map((item) => {
                        const isSelected = activeCommsFriend?.id === item.user.id;
                        return (
                          <div
                            key={item.friendshipId}
                            onClick={() => {
                              marsAudio.playUiClick?.();
                              setActiveCommsFriend(item.user);
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                              isSelected
                                ? 'bg-cyan-950/50 border-cyan-500/60 shadow-lg shadow-cyan-950/50'
                                : 'bg-space-900/40 border-white/5 hover:bg-space-900/80 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-space-800 border border-cyan-500/30 flex items-center justify-center font-display font-bold text-cyan-300 text-xs shrink-0">
                                {item.user.username?.slice(0, 2).toUpperCase() || 'EX'}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-display font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{item.user.username}</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                </div>
                                <div className="text-[10px] font-mono text-stone-400 truncate flex items-center gap-1">
                                  <ShieldCheck size={11} className="text-cyan-400 shrink-0" />
                                  <span>{item.user.rank || 'Active Astronaut'}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFriend(item.friendshipId);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/20 text-stone-500 hover:text-red-400 transition-all"
                              title="Disconnect crewmate"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. SEARCH ASTRONAUTS */}
                {activeTab === 'search' && (
                  <div className="space-y-3">
                    <form onSubmit={handleSearch} className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search callsign..."
                          className="w-full bg-space-900/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-stone-500 focus:outline-none focus:border-cyan-500/60"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0"
                      >
                        <Search size={12} />
                        <span>Find</span>
                      </button>
                    </form>

                    <div className="space-y-1.5">
                      {searchResults.filter((target) => target && target.id !== user?.id).map((target) => {
                        const feedback = actionFeedback[target.id];
                        const isAlreadyFriend = friends.some((f) => f.user.id === target.id);
                        const isPendingOutgoing = outgoingRequests.some((r) => r.user.id === target.id);

                        return (
                          <div
                            key={target.id}
                            className="p-2.5 rounded-xl border border-white/5 bg-space-900/40 flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-display font-bold text-white truncate">
                                {target.username}
                              </div>
                              <div className="text-[10px] font-mono text-stone-400 truncate">
                                {target.rank || 'Explorer'}
                              </div>
                            </div>

                            {isAlreadyFriend ? (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                                Crewmate
                              </span>
                            ) : isPendingOutgoing || feedback === 'sent' ? (
                              <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                                Pending
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(target)}
                                disabled={feedback === 'sending'}
                                className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-[11px] font-mono font-medium transition-all flex items-center gap-1"
                              >
                                <UserPlus size={11} />
                                <span>{feedback === 'sending' ? 'Sending...' : 'Add'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {searchResults.length === 0 && searchQuery && !isSearching && (
                        <div className="text-center text-xs font-mono text-stone-500 py-4">
                          No astronauts found with callsign "{searchQuery}".
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. REQUESTS (INCOMING & OUTGOING) */}
                {activeTab === 'requests' && (
                  <div className="space-y-4">
                    {/* Incoming */}
                    <div>
                      <div className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users size={12} />
                        <span>Incoming Requests ({incomingRequests.length})</span>
                      </div>
                      {incomingRequests.length === 0 ? (
                        <div className="text-xs font-mono text-stone-500 py-1">No incoming requests.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {incomingRequests.filter((req) => req.user && req.user.id !== user?.id).map((req) => (
                            <div
                              key={req.friendshipId}
                              className="p-2.5 rounded-xl border border-cyan-900/40 bg-space-900/60 flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-display font-bold text-white truncate">
                                  {req.user.username}
                                </div>
                                <div className="text-[10px] font-mono text-stone-400 truncate">
                                  {req.user.rank || 'Explorer'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleRespondRequest(req.friendshipId, true)}
                                  className="p-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300"
                                  title="Accept Request"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => handleRespondRequest(req.friendshipId, false)}
                                  className="p-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300"
                                  title="Decline Request"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Outgoing */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>Sent Requests ({outgoingRequests.length})</span>
                      </div>
                      {outgoingRequests.length === 0 ? (
                        <div className="text-xs font-mono text-stone-500 py-1">No pending requests sent.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {outgoingRequests.filter((req) => req.user && req.user.id !== user?.id).map((req) => (
                            <div
                              key={req.friendshipId}
                              className="p-2 rounded-lg border border-white/5 bg-space-900/30 flex items-center justify-between text-xs"
                            >
                              <span className="font-mono text-stone-300 truncate">{req.user.username}</span>
                              <button
                                onClick={() => handleRespondRequest(req.friendshipId, false)}
                                className="text-[10px] font-mono text-stone-500 hover:text-red-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Active Direct Transmission Channel */}
            <div className="flex-1 flex flex-col bg-space-950/80 h-full overflow-hidden">
              {activeCommsFriend ? (
                <>
                  {/* Channel Header */}
                  <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-space-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center font-display font-bold text-cyan-300 text-xs">
                        {activeCommsFriend.username?.slice(0, 2).toUpperCase() || 'EX'}
                      </div>
                      <div>
                        <div className="text-xs font-display font-bold text-white flex items-center gap-2">
                          <span>{activeCommsFriend.username}</span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">
                            P2P UPLINK
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-stone-400">
                          {activeCommsFriend.rank || 'Active Astronaut'}
                        </div>
                      </div>
                    </div>

                    {/* Quick Share Surface Coordinates Button */}
                    {mapCenter && (
                      <button
                        onClick={() => setShareCoords(!shareCoords)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition-all ${
                          shareCoords
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                            : 'bg-space-800/60 text-stone-300 border-white/10 hover:bg-space-800 hover:text-white'
                        }`}
                        title="Transmit current map coordinates with your message"
                      >
                        <MapPin size={12} className={shareCoords ? 'text-amber-400' : 'text-stone-400'} />
                        <span>{shareCoords ? 'Coords Attached' : 'Attach Coords'}</span>
                      </button>
                    )}
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar-y p-4 space-y-3">
                    {isLoadingMessages ? (
                      <div className="h-full flex items-center justify-center text-xs font-mono text-cyan-400 animate-pulse">
                        TUNING DSN TRANSCEIVER FREQUENCY...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 font-mono text-xs p-6">
                        <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-cyan-400" />
                        <p className="text-stone-300 font-bold mb-1">Channel Open</p>
                        <p className="text-[11px]">
                          Transmit your first message across the Mars surface network to{' '}
                          <span className="text-cyan-300 font-bold">{activeCommsFriend.username}</span>.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSelf = msg.sender_id === user.id;
                        const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500 mb-1 px-1">
                              <span>{isSelf ? 'You' : activeCommsFriend.username}</span>
                              <span>•</span>
                              <span>{timeStr}</span>
                            </div>

                            <div
                              className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl text-xs font-mono leading-relaxed break-words shadow-md ${
                                isSelf
                                  ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/40 rounded-br-sm'
                                  : 'bg-space-900 text-stone-200 border border-white/10 rounded-bl-sm'
                              }`}
                            >
                              <p>{msg.content}</p>

                              {/* Action Data: Coordinates or Mission Telemetry */}
                              {msg.action_data?.type === 'coordinates' && (
                                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-3 bg-black/40 -mx-1 -mb-1 p-2 rounded-xl">
                                  <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-bold">
                                    <MapPin size={12} className="text-amber-400 shrink-0" />
                                    <span>
                                      {msg.action_data.lat}°, {msg.action_data.lon}°
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleTeleportToCoords(msg.action_data)}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition-all flex items-center gap-1"
                                  >
                                    <Compass size={10} />
                                    <span>View on Map</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Footer */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-3 border-t border-white/10 bg-space-950 flex flex-col gap-2 shrink-0"
                  >
                    {shareCoords && mapCenter && (
                      <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded-lg flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-amber-400" />
                          <span>
                            Attaching Map Position: {mapCenter[0].toFixed(2)}°N, {mapCenter[1].toFixed(2)}°E
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShareCoords(false)}
                          className="text-stone-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={`Transmit to ${activeCommsFriend.username}...`}
                        className="flex-1 bg-space-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-stone-500 focus:outline-none focus:border-cyan-500/60"
                      />
                      <button
                        type="submit"
                        disabled={!messageInput.trim() || isTransmitting}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black font-display font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-cyan-600 flex items-center gap-1.5 shrink-0"
                      >
                        <Send size={13} />
                        <span className="hidden sm:inline">Transmit</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Empty state when no friend selected */
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 font-mono">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-950/50">
                    <Radio className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="text-base font-display font-black text-white uppercase tracking-wider mb-1">
                      DSN Inter-Astronaut Network
                    </h3>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Select a fellow astronaut from your crew list, or add explorers by callsign to start real-time communication and share surface coordinates.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <UserPlus size={14} />
                      <span>Search Explorer Callsigns</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
