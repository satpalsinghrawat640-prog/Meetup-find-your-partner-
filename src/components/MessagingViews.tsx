import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  doc,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import {
  Search,
  Globe,
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  Reply,
  Trash2,
  Palette,
  Flag,
  Ban,
  User as UserIcon,
  MicOff,
  VideoOff,
  PhoneOff,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { db } from '../lib/firebase';
import { CHAT_THEMES } from '../lib/constants';
import { ChatMessage, MatchRecord, UserProfile } from '../types/igmeet';
import {
  deleteMessageForEveryone,
  getSavedChatTheme,
  isPaidActive,
  markMessageRead,
  reactToMessage,
  saveChatTheme,
  sendGlobalMessage,
  sendPersonalMessage,
  setTypingIndicator,
  subscribeTypingIndicator,
  uploadToFirebaseStorage
} from '../services/igmeetService';

interface MessagesTabProps {
  me: UserProfile;
  matches: { chat: MatchRecord; peer: UserProfile }[];
  horizontalProfiles: UserProfile[];
  globalPreview: { lastMessage: string; time: number; unread: number };
  onOpenGlobalChat: () => void;
  onOpenPersonalChat: (chatId: string, peer: UserProfile) => void;
  onOpenProfile: (peer: UserProfile) => void;
}

export function MessagesTabView({
  me,
  matches,
  horizontalProfiles,
  globalPreview,
  onOpenGlobalChat,
  onOpenPersonalChat,
  onOpenProfile
}: MessagesTabProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredChats = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      ({ peer }) =>
        peer.fullName.toLowerCase().includes(q) || peer.username.toLowerCase().includes(q)
    );
  }, [matches, searchText]);

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-[#FFF8FA] dark:bg-[#140E12]">
      {/* Header: Messages + Search icon ONLY (NO notification bell on Messages) */}
      <header className="h-14 px-4 flex items-center justify-between bg-white dark:bg-[#1C1419] border-b border-rose-100 dark:border-neutral-800 shrink-0">
        <h1 className="text-lg font-extrabold">Messages</h1>
        <button
          type="button"
          onClick={() => setSearchOpen((s) => !s)}
          aria-label="Search messages"
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-rose-50 dark:hover:bg-neutral-800"
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      {searchOpen && (
        <div className="px-4 py-2.5 bg-white dark:bg-[#1C1419] border-b border-rose-100 dark:border-neutral-800 shrink-0">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search personal chats..."
            className="w-full h-10 px-3.5 rounded-xl bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-rose-100/70 dark:divide-neutral-800">
        {/* FIRST: Horizontal Profile Row (3-7 visible, name directly underneath photo) */}
        <section className="px-4 py-3.5 bg-white dark:bg-[#1C1419]">
          <div className="flex items-start gap-3.5 overflow-x-auto no-scrollbar">
            {horizontalProfiles.length === 0 ? (
              <p className="text-xs text-[#6E5A63] dark:text-neutral-400 py-2">
                No active profiles to display yet.
              </p>
            ) : (
              horizontalProfiles.slice(0, 12).map((person) => (
                <button
                  key={person.uid}
                  type="button"
                  onClick={() => onOpenProfile(person)}
                  className="flex flex-col items-center w-16 shrink-0 gap-1.5"
                >
                  <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#FF2D78] to-[#FF80AB]">
                    <img
                      src={person.photoUrl}
                      alt={person.fullName}
                      className="w-full h-full rounded-full object-cover border-2 border-white dark:border-[#1C1419]"
                    />
                    {person.online && person.privacy?.showOnlineStatus !== false && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1C1419]" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-center truncate w-full">
                    {person.fullName.split(' ')[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* SECOND: Global Chat immediately below profile row */}
        <section className="bg-white dark:bg-[#1C1419]">
          <button
            type="button"
            onClick={onOpenGlobalChat}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-rose-50/50 dark:hover:bg-neutral-900"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] text-white flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold">Global Chat</span>
                <span className="text-[11px] text-[#6E5A63] dark:text-neutral-400 tabular-nums">
                  {formatTime(globalPreview.time)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs text-[#6E5A63] dark:text-neutral-400 truncate">
                  {globalPreview.lastMessage || 'Join the live IG Meet community conversation'}
                </p>
                {globalPreview.unread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF2D78] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {globalPreview.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        </section>

        {/* THIRD: Personal Chats sorted by latest message */}
        <section className="p-4 space-y-2.5">
          {filteredChats.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6E5A63] dark:text-neutral-400">
              No personal chats yet. Match with people on Home or message eligible profiles.
            </div>
          ) : (
            filteredChats.map(({ chat, peer }) => {
              const unread = chat.unreadBy?.[me.uid] || 0;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onOpenPersonalChat(chat.id, peer)}
                  className="w-full p-3 rounded-2xl bg-white dark:bg-[#1C1419] border border-rose-100/70 dark:border-neutral-800 flex items-center gap-3 text-left"
                >
                  <div className="relative w-12 h-12 shrink-0">
                    <img
                      src={peer.photoUrl}
                      alt={peer.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                    {peer.online && peer.privacy?.showOnlineStatus !== false && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1C1419]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-sm font-bold">{peer.fullName}</span>
                        <span className="text-[11px] text-[#6E5A63] dark:text-neutral-400 ml-1.5">
                          @{peer.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6E5A63] dark:text-neutral-400 tabular-nums shrink-0">
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-[#6E5A63] dark:text-neutral-400 truncate">
                        {chat.lastMessage || 'New match — start a conversation'}
                      </p>
                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF2D78] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

interface GlobalChatProps {
  me: UserProfile;
  onlineCount: number;
  blockedUids: Set<string>;
  onBack: () => void;
  onReportUser: (uid: string, name: string) => void;
  onBlockUid: (uid: string, name: string) => void;
  onOpenUpgrade: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function GlobalChatScreen({
  me,
  onlineCount,
  blockedUids,
  onBack,
  onReportUser,
  onBlockUid,
  onOpenUpgrade,
  onToast
}: GlobalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canShareMedia = isPaidActive(me);

  useEffect(() => {
    const q = query(collection(db, 'globalChatMessages'), orderBy('createdAt', 'asc'), limit(100));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
        .filter((m) => !blockedUids.has(m.senderId));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    });
  }, [blockedUids]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (Date.now() - lastSentAt < 1500) {
      onToast('Please wait a moment before sending another message.', 'info');
      return;
    }
    setText('');
    setLastSentAt(Date.now());
    try {
      await sendGlobalMessage(me, { type: 'text', text: trimmed });
    } catch {
      onToast('Failed to send message.', 'error');
    }
  };

  const handleMediaUpload = async (file: File) => {
    if (!canShareMedia) {
      onOpenUpgrade();
      return;
    }
    try {
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      const url = await uploadToFirebaseStorage(`globalChat/${me.uid}_${Date.now()}`, file);
      await sendGlobalMessage(me, { type: mediaType, mediaUrl: url });
    } catch (err: unknown) {
      onToast((err as Error)?.message || 'Unable to upload media.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#FFF8FA] dark:bg-[#140E12] flex flex-col max-w-[430px] mx-auto">
      <header className="h-14 px-3 flex items-center justify-between bg-white dark:bg-[#1C1419] border-b border-rose-100 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF2D78] to-[#E91E4D] text-white flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Global Chat</h2>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              {onlineCount} Online Members
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="Global chat menu"
            className="w-10 h-10 rounded-full flex items-center justify-center"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-44 rounded-2xl bg-white dark:bg-[#241A20] border border-rose-100 dark:border-neutral-700 shadow-xl p-1.5 z-50">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowRules(true);
                }}
                className="w-full px-3 py-2.5 text-left text-xs font-semibold rounded-xl hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                Chat Rules
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.map((m) => {
          const mine = m.senderId === me.uid;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (
                <img
                  src={m.senderPhoto || ''}
                  alt={m.senderName || 'Member'}
                  className="w-8 h-8 rounded-full object-cover shrink-0 mt-1 bg-rose-100"
                />
              )}
              <div className={`max-w-[78%] space-y-1 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#6E5A63] dark:text-neutral-400">
                    <span>{m.senderName || 'Member'}</span>
                    <button
                      type="button"
                      onClick={() => onReportUser(m.senderId, m.senderName || 'Member')}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      Report
                    </button>
                    <button
                      type="button"
                      onClick={() => onBlockUid(m.senderId, m.senderName || 'Member')}
                      className="text-[10px] text-neutral-500 hover:underline"
                    >
                      Block
                    </button>
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                    mine
                      ? 'bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white rounded-br-md'
                      : 'bg-white dark:bg-[#1F171C] border border-rose-100/70 dark:border-neutral-800 rounded-bl-md'
                  }`}
                >
                  {m.deletedForEveryone ? (
                    <span className="italic opacity-70 text-xs">Message removed by moderation</span>
                  ) : m.type === 'image' && m.mediaUrl ? (
                    <img src={m.mediaUrl} alt="Shared media" className="max-w-[210px] rounded-xl" />
                  ) : m.type === 'video' && m.mediaUrl ? (
                    <video src={m.mediaUrl} controls className="max-w-[210px] rounded-xl" />
                  ) : (
                    <span>{m.text}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400 tabular-nums">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {(me.role === 'owner' || me.role === 'admin') && !m.deletedForEveryone && (
                    <button
                      type="button"
                      onClick={() => updateDoc(doc(db, 'globalChatMessages', m.id), { deletedForEveryone: true })}
                      className="text-rose-500 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="p-2.5 bg-white dark:bg-[#1C1419] border-t border-rose-100 dark:border-neutral-800 flex items-center gap-2 shrink-0"
      >
        <label
          onClick={(e) => {
            if (!canShareMedia) {
              e.preventDefault();
              onOpenUpgrade();
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#E91E4D] hover:bg-rose-50 dark:hover:bg-neutral-800 cursor-pointer shrink-0"
          aria-label="Share photo or video"
        >
          <ImageIcon className="w-5 h-5" />
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleMediaUpload(f);
            }}
          />
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message Global Chat..."
          className="flex-1 h-10 px-4 rounded-full bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5">
          <div className="w-full max-w-[360px] bg-white dark:bg-[#1C1419] rounded-3xl p-5 space-y-3">
            <h3 className="text-base font-extrabold">Global Chat Rules</h3>
            <ul className="text-xs text-[#6E5A63] dark:text-neutral-300 space-y-1.5 list-disc pl-4">
              <li>Respect all adult members (18+). Harassment or hate speech results in immediate ban.</li>
              <li>Do not spam links, phone numbers, or solicitation messages.</li>
              <li>Photo and video sharing is available for Plus and Elite members.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="w-full h-10 rounded-xl bg-[#FF2D78] text-white text-xs font-bold"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PersonalChatProps {
  chatId: string;
  me: UserProfile;
  peer: UserProfile;
  onBack: () => void;
  onViewProfile: (peer: UserProfile) => void;
  onBlockPeer: (peer: UserProfile) => void;
  onReportPeer: (peer: UserProfile) => void;
  onOpenUpgrade: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export function PersonalChatScreen({
  chatId,
  me,
  peer,
  onBack,
  onViewProfile,
  onBlockPeer,
  onReportPeer,
  onOpenUpgrade,
  onToast
}: PersonalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage['replyTo']>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [chatTheme, setChatTheme] = useState(() => getSavedChatTheme(chatId));
  const [peerTyping, setPeerTyping] = useState(false);
  const [callPreview, setCallPreview] = useState<'voice' | 'video' | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const iAmPaid = isPaidActive(me);
  const eitherParticipantPaid = iAmPaid || isPaidActive(peer);
  const activeThemeObj = CHAT_THEMES.find((t) => t.id === chatTheme.colorId) || CHAT_THEMES[0];

  useEffect(() => {
    // Reset my unread count on open
    updateDoc(doc(db, 'personalChats', chatId), { [`unreadBy.${me.uid}`]: 0 }).catch(() => {});

    const q = query(collection(db, 'personalMessages'), where('chatId', '==', chatId), limit(150));
    const unsubMsgs = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
        .sort((a, b) => a.createdAt - b.createdAt);
      setMessages(list);
      list.forEach((m) => {
        if (m.senderId !== me.uid && !m.readBy?.includes(me.uid)) {
          markMessageRead(m.id, me.uid);
        }
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    });

    const unsubTyping = subscribeTypingIndicator(chatId, peer.uid, setPeerTyping);
    return () => {
      unsubMsgs();
      unsubTyping();
      setTypingIndicator(chatId, me.uid, false);
    };
  }, [chatId, me.uid, peer.uid]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    setTypingIndicator(chatId, me.uid, false);
    try {
      await sendPersonalMessage(chatId, me, peer.uid, {
        type: 'text',
        text: trimmed,
        replyTo
      });
      setReplyTo(null);
    } catch {
      onToast('Message could not be sent.', 'error');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!eitherParticipantPaid) {
      onOpenUpgrade();
      return;
    }
    try {
      const url = await uploadToFirebaseStorage(`personalChats/${chatId}/${me.uid}_${Date.now()}.jpg`, file);
      await sendPersonalMessage(chatId, me, peer.uid, { type: 'image', mediaUrl: url });
    } catch (err: unknown) {
      onToast((err as Error)?.message || 'Photo upload failed.', 'error');
    }
  };

  const handleVoiceToggle = async () => {
    if (!iAmPaid) {
      onOpenUpgrade();
      return;
    }
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => chunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const url = await uploadToFirebaseStorage(`voiceMessages/${chatId}/${me.uid}_${Date.now()}.webm`, file);
        await sendPersonalMessage(chatId, me, peer.uid, { type: 'voice', mediaUrl: url });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      onToast('Recording voice message. Tap microphone again to send.', 'info');
    } catch {
      onToast('Microphone permission is required for voice messages.', 'error');
    }
  };

  const handleCallTap = (type: 'voice' | 'video') => {
    if (!iAmPaid) {
      onOpenUpgrade();
      return;
    }
    setCallPreview(type);
  };

  const handleClearChat = async () => {
    setMenuOpen(false);
    try {
      const q = query(collection(db, 'personalMessages'), where('chatId', '==', chatId));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.filter((d) => d.data().senderId === me.uid).map((d) => deleteDoc(d.ref))
      );
      onToast('Your messages in this chat were cleared.', 'success');
    } catch {
      onToast('Unable to clear chat.', 'error');
    }
  };

  const peerStatusText = peerTyping
    ? 'Typing...'
    : peer.online && peer.privacy?.showOnlineStatus !== false
    ? 'Online'
    : peer.lastSeen && peer.privacy?.showLastSeen !== false
    ? `Last seen ${new Date(peer.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Offline';

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col max-w-[430px] mx-auto ${activeThemeObj.bgClass}`}
      style={
        chatTheme.customBgUrl
          ? { backgroundImage: `url(${chatTheme.customBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      {/* Header */}
      <header className="h-15 px-2.5 flex items-center gap-1.5 bg-white/95 dark:bg-[#1C1419]/95 border-b border-rose-100 dark:border-neutral-800 shrink-0">
        <button type="button" onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onViewProfile(peer)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
        >
          <img src={peer.photoUrl} alt={peer.fullName} className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate">{peer.fullName}</div>
            <div className="text-[11px] text-[#6E5A63] dark:text-neutral-400 truncate">{peerStatusText}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleCallTap('voice')}
          aria-label="Voice Call"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#E91E4D]"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleCallTap('video')}
          aria-label="Video Call"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#E91E4D]"
        >
          <Video className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="Chat options"
            className="w-10 h-10 rounded-full flex items-center justify-center"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-48 rounded-2xl bg-white dark:bg-[#241A20] border border-rose-100 dark:border-neutral-700 shadow-xl p-1.5 z-50 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onViewProfile(peer);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                <UserIcon className="w-4 h-4" />
                <span>View Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (!iAmPaid) {
                    onOpenUpgrade();
                    return;
                  }
                  setThemePickerOpen(true);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                <Palette className="w-4 h-4" />
                <span>Chat Theme</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onBlockPeer(peer);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-rose-600 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                <Ban className="w-4 h-4" />
                <span>Block User</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReportPeer(peer);
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                <Flag className="w-4 h-4" />
                <span>Report User</span>
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-neutral-800"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Chat</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {messages.map((m) => {
          const mine = m.senderId === me.uid;
          const isRead = m.readBy?.includes(peer.uid);
          const reactions = Object.values(m.reactions || {});
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {m.replyTo && (
                <div className="text-[11px] px-2.5 py-1 mb-1 rounded-lg bg-black/10 dark:bg-white/10 max-w-[75%] truncate">
                  Replying to {m.replyTo.senderName}: {m.replyTo.preview}
                </div>
              )}
              <div
                className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm shadow-xs ${
                  mine
                    ? `${activeThemeObj.bubbleMe} rounded-br-md`
                    : 'bg-white dark:bg-[#1F171C] text-[#1A1015] dark:text-white rounded-bl-md'
                }`}
              >
                {m.deletedForEveryone ? (
                  <span className="italic opacity-75 text-xs">This message was deleted</span>
                ) : m.type === 'image' && m.mediaUrl ? (
                  <img src={m.mediaUrl} alt="Shared photo" className="max-w-[210px] rounded-xl" />
                ) : m.type === 'voice' && m.mediaUrl ? (
                  <audio src={m.mediaUrl} controls className="max-w-[210px] h-9" />
                ) : (
                  <span>{m.text}</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-[10px] text-[#6E5A63] dark:text-neutral-400">
                <span className="tabular-nums">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {mine && (isRead ? <CheckCheck className="w-3.5 h-3.5 text-[#FF2D78]" /> : <Check className="w-3.5 h-3.5" />)}
                {!m.deletedForEveryone && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setReplyTo({
                          id: m.id,
                          senderName: mine ? 'You' : peer.fullName,
                          preview: m.text || m.type
                        })
                      }
                      className="hover:text-[#FF2D78]"
                      aria-label="Reply"
                    >
                      <Reply className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => reactToMessage(m.id, me.uid, 'Liked')}
                      className="hover:text-[#FF2D78]"
                    >
                      Like
                    </button>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => deleteMessageForEveryone(m.id)}
                        className="text-rose-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
                {reactions.length > 0 && (
                  <span className="font-bold text-[#FF2D78]">{reactions.length} Liked</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-neutral-900 border-t border-rose-100 dark:border-neutral-800 flex items-center justify-between text-xs">
          <span className="truncate">
            Replying to <strong>{replyTo.senderName}</strong>: {replyTo.preview}
          </span>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Input Bar: Attachment, Text Input, Voice Message, Send */}
      <form
        onSubmit={handleSendText}
        className="p-2.5 bg-white/95 dark:bg-[#1C1419]/95 border-t border-rose-100 dark:border-neutral-800 flex items-center gap-1.5 shrink-0"
      >
        <label
          onClick={(e) => {
            if (!eitherParticipantPaid) {
              e.preventDefault();
              onOpenUpgrade();
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#6E5A63] dark:text-neutral-300 cursor-pointer shrink-0"
          aria-label="Attach photo"
        >
          <Paperclip className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handlePhotoUpload(f);
            }}
          />
        </label>

        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTypingIndicator(chatId, me.uid, e.target.value.trim().length > 0);
          }}
          placeholder="Type a message..."
          className="flex-1 h-10 px-4 rounded-full bg-[#FFF8FA] dark:bg-neutral-900 border border-rose-100 dark:border-neutral-800 text-sm outline-none focus:border-[#FF2D78]"
        />

        <button
          type="button"
          onClick={handleVoiceToggle}
          aria-label="Voice message"
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            recording ? 'bg-rose-600 text-white' : 'text-[#6E5A63] dark:text-neutral-300'
          }`}
        >
          <Mic className="w-5 h-5" />
        </button>

        <button
          type="submit"
          aria-label="Send"
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF2D78] to-[#E91E4D] text-white flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Per-Chat Theme Picker Modal (7 color options + custom background) */}
      {themePickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-end justify-center">
          <div className="w-full max-w-[430px] bg-white dark:bg-[#1C1419] rounded-t-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">Personal Chat Theme</h3>
              <button type="button" onClick={() => setThemePickerOpen(false)} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CHAT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const next = { colorId: t.id, customBgUrl: undefined };
                    setChatTheme(next);
                    saveChatTheme(chatId, next);
                    onToast(`Applied ${t.name} theme to this chat.`, 'success');
                  }}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold ${
                    chatTheme.colorId === t.id && !chatTheme.customBgUrl
                      ? 'border-[#FF2D78] bg-rose-50 dark:bg-rose-950/40 text-[#E91E4D]'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <label className="w-full h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
              <ImageIcon className="w-4 h-4" />
              <span>Upload Custom Background Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await uploadToFirebaseStorage(`chatThemes/${chatId}/${me.uid}_${Date.now()}.jpg`, f);
                    const next = { ...chatTheme, customBgUrl: url };
                    setChatTheme(next);
                    saveChatTheme(chatId, next);
                    setThemePickerOpen(false);
                    onToast('Custom chat background saved.', 'success');
                  } catch {
                    onToast('Background upload failed.', 'error');
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Call Preview Interface (Transparently labeled as preview until calling SDK is connected) */}
      {callPreview && (
        <div className="fixed inset-0 z-50 bg-[#1A1015] text-white flex flex-col justify-between p-6 max-w-[430px] mx-auto">
          <div className="text-center pt-6 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF80AB]">
              {callPreview === 'video' ? 'Video Call Preview' : 'Voice Call Preview'}
            </p>
            <h2 className="text-2xl font-extrabold">{peer.fullName}</h2>
            <p className="text-xs text-white/75">
              Call preview interface — connect an approved Calling SDK (ZegoCloud / Agora / WebRTC TURN) to enable live audio and video transport.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <img
              src={peer.photoUrl}
              alt={peer.fullName}
              className="w-28 h-28 rounded-full object-cover border-4 border-[#FF2D78]"
            />
          </div>

          <div className="flex items-center justify-center gap-6 pb-6">
            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              aria-label="Toggle microphone"
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                micMuted ? 'bg-white text-[#1A1015]' : 'bg-white/15 text-white'
              }`}
            >
              {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {callPreview === 'video' && (
              <button
                type="button"
                onClick={() => setCamOff((c) => !c)}
                aria-label="Toggle camera"
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  camOff ? 'bg-white text-[#1A1015]' : 'bg-white/15 text-white'
                }`}
              >
                {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCallPreview(null);
                setMicMuted(false);
                setCamOff(false);
              }}
              aria-label="End call preview"
              className="w-16 h-16 rounded-full bg-[#E91E4D] text-white flex items-center justify-center"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
