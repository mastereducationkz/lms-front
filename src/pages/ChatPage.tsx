import { useEffect, useRef, useState, FormEvent, Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { isAuthenticated, fetchThreads, fetchMessages, getAvailableContacts, sendMessage, getCurrentUser, fetchGroupThreads, fetchGroupMessages, sendGroupMessage, reactToMessage, reportMessage, getMutedConversations, muteConversation, unmuteConversation } from "../services/api";
import type { MessageThread, AvailableContact, User, GroupThread } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { BellOff, Info, Reply as ReplyIcon, X } from 'lucide-react';
import { connectSocket } from '../services/socket';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import { ChatAttachment } from '../components/chat/ChatAttachment';
import { ChatMessageBubble, type ChatMessage } from '../components/chat/ChatMessageBubble';
import { ChatInfoDialog } from '../components/chat/ChatInfoDialog';
import { DateSeparator, UnreadDivider, isSameDay, formatDateSeparator, formatMessageTime } from '../components/chat/ChatSeparators';

// Backstop only: how long to wait for the send ack before giving up on it ever arriving.
// Success/failure is decided by the ack itself (see `deliver`), not by this clock.
//
// That decision depends on the server emitting the echo before its handler returns, over
// the same connection the ack goes down -- true only while the Socket.IO server runs
// without a client_manager. If one is ever added (see the note in the backend's
// socket_messages.py), the echo moves to pub/sub, the ack can arrive first, and every send
// will look failed. Read the ack's payload instead if that happens.
const SEND_ACK_TIMEOUT_MS = 15000;

let clientMsgCounter = 0;
function nextClientId(): string {
  clientMsgCounter += 1;
  return `tmp-${Date.now()}-${clientMsgCounter}`;
}

// Merge a server echo into the list: dedup by id, and when the echo is one of our own
// sends, replace the matching optimistic bubble in place so it flips pending → sent
// instead of appearing twice.
function reconcileEcho(list: ChatMessage[], echo: ChatMessage, meId: number | null): ChatMessage[] {
  if (list.some(m => m.id === echo.id)) return list;
  if (meId !== null && echo.from_user_id === meId) {
    const idx = list.findIndex(m =>
      m._status === 'pending' && m.content === echo.content && (m.file_url ?? '') === (echo.file_url ?? ''));
    if (idx !== -1) {
      const next = [...list];
      next[idx] = { ...echo, _clientId: list[idx]._clientId };
      return next;
    }
  }
  return [...list, echo];
}

// Swap an optimistic bubble for the message the REST fallback persisted.
function replacePending(list: ChatMessage[], clientId: string, saved: ChatMessage): ChatMessage[] {
  return list.some(m => m.id === saved.id)
    ? list.filter(m => m._clientId !== clientId)
    : list.map(m => (m._clientId === clientId ? { ...saved, _clientId: clientId } : m));
}

export default function ChatPage() {
  const location = useLocation();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [groupThreads, setGroupThreads] = useState<GroupThread[]>([]);
  const [activeGroupConvId, setActiveGroupConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState<string>('');
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [mutedIds, setMutedIds] = useState<Set<number>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
  // First message the partner sent that we had not read when the thread opened — the
  // "unread messages" divider sits above it until the thread is reopened.
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // DOM refs per message id so a reply preview can scroll to the original bubble.
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const registerMessageRef = (id: number, el: HTMLDivElement | null) => {
    messageRefs.current[id] = el;
  };
  const jumpToMessage = (id: number) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'rounded-xl'), 1200);
    }
  };

  // Загрузка пользователя и списка разговоров
  useEffect(() => {
    loadCurrentUser();
    loadThreads();
    void loadGroupThreads();
    loadAvailableContacts();
    void getMutedConversations().then((ids) => setMutedIds(new Set(ids)));
  }, []);

  // Handle navigation state to open chat with specific user
  useEffect(() => {
    const contactUserId = (location.state as any)?.contactUserId;
    if (contactUserId && availableContacts.length > 0) {
      // Find the contact in available contacts
      const contact = availableContacts.find(c => c.user_id === contactUserId);
      if (contact) {
        // Start chat with this contact
        startNewChat(contact);
      }
      // Clear the navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, availableContacts]);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  // Socket.IO setup
  useEffect(() => {
    if (!isAuthenticated()) return;
    const socket = connectSocket();

    const onMessageNew = (payload: any) => {
      const involvesActive = payload.from_user_id === activePartnerId || payload.to_user_id === activePartnerId;
      if (involvesActive) {
        setMessages(prev => reconcileEcho(prev, payload, currentUser ? Number(currentUser.id) : null));
      }
      // Acknowledge delivery of any incoming message so the sender gets the double tick.
      const incoming = payload.to_user_id === currentUser?.id && payload.from_user_id !== currentUser?.id;
      if (incoming) {
        const s = connectSocket();
        if (s && s.connected) s.emit('message:delivered', { partner_id: payload.from_user_id });
      }
    };

    const onMessageUpdated = (payload: any) => {
      // Full message payload: merge receipts + reactions in place.
      setMessages(prev => prev.map(m => m.id === payload.id ? { ...m, ...payload } : m));
    };

    // Legacy bulk read event (older backends) — mark listed ids read.
    const onMessageBulkUpdated = (payload: any) => {
      const ids: number[] = payload?.message_ids || payload?.ids || [];
      if (ids.length) setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, is_read: true } : m));
    };

    // Rich delivery/read receipts.
    const onMessageReceipts = (payload: any) => {
      const ids: number[] = payload?.message_ids || [];
      const status: string = payload?.status;
      if (!ids.length) return;
      const now = new Date().toISOString();
      setMessages(prev => prev.map(m => {
        if (!ids.includes(m.id)) return m;
        if (status === 'read') return { ...m, is_read: true, read_at: m.read_at || now, delivered_at: m.delivered_at || now };
        if (status === 'delivered') return { ...m, delivered_at: m.delivered_at || now };
        return m;
      }));
    };

    // A message's reaction set changed.
    const onMessageReaction = (payload: any) => {
      const { message_id, reactions } = payload || {};
      if (!message_id) return;
      setMessages(prev => prev.map(m => m.id === message_id ? { ...m, reactions: reactions || [] } : m));
    };

    const onThreadsUpdate = async () => {
      await loadThreads();
    };

    const onUnreadUpdate = () => {
      updateUnreadCount();
    };

    const onGroupMessageNew = (payload: any) => {
      if (payload.conversation_id === activeGroupConvId) {
        setMessages(prev => reconcileEcho(prev, payload, currentUser ? Number(currentUser.id) : null));
      }
      void loadGroupThreads();
    };

    const onGroupThreadsUpdate = () => {
      void loadGroupThreads();
    };

    const onGroupUnreadUpdate = () => {
      void loadGroupThreads();
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:bulk-updated', onMessageBulkUpdated);
    socket.on('message:receipts', onMessageReceipts);
    socket.on('message:reaction', onMessageReaction);
    socket.on('threads:update', onThreadsUpdate);
    socket.on('unread:update', onUnreadUpdate);
    socket.on('group:message:new', onGroupMessageNew);
    socket.on('group:threads:update', onGroupThreadsUpdate);
    socket.on('group:unread:update', onGroupUnreadUpdate);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:bulk-updated', onMessageBulkUpdated);
      socket.off('message:receipts', onMessageReceipts);
      socket.off('message:reaction', onMessageReaction);
      socket.off('threads:update', onThreadsUpdate);
      socket.off('unread:update', onUnreadUpdate);
      socket.off('group:message:new', onGroupMessageNew);
      socket.off('group:threads:update', onGroupThreadsUpdate);
      socket.off('group:unread:update', onGroupUnreadUpdate);
    };
  }, [activePartnerId, activeGroupConvId, currentUser?.id]);

  // Загрузка сообщений при смене активного партнера
  useEffect(() => {
    if (!activePartnerId) return;
    setReplyingTo(null);

    const loadMessages = async () => {
      const msgs: ChatMessage[] = await fetchMessages(String(activePartnerId));
      const ordered = msgs.reverse();
      // Capture the divider position BEFORE marking the thread read, otherwise the
      // read receipt lands first and there is nothing left to divide.
      const firstUnread = ordered.find(m => !m.is_read && m.from_user_id === activePartnerId);
      setFirstUnreadId(firstUnread ? firstUnread.id : null);
      setMessages(ordered);
      const socket = connectSocket();
      if (socket && socket.connected) {
        socket.emit('message:read-all', { partner_id: activePartnerId });
      }
      updateUnreadCount();
      await loadThreads();
    };

    loadMessages();
    
    // Автообновление отключено (реалтайм через сокеты)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activePartnerId]);

  // Автообновление списка разговоров: только пока вкладка активна (realtime идёт через сокеты,
  // это лишь запасной поллинг), интервал увеличен 10s → 30s чтобы не долбить бэкенд.
  useVisiblePolling(() => { void loadThreads(); void loadGroupThreads(); }, 30000);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadThreads = async () => {
    try {
      const threadsData: any[] = await fetchThreads();
      setThreads(threadsData);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadGroupThreads = async () => {
    try {
      const data = await fetchGroupThreads();
      setGroupThreads(data);
    } catch (error) {
      console.error('Failed to load group threads:', error);
    }
  };

  // Функция для обновления счетчика непрочитанных сообщений в сайдбаре
  const updateUnreadCount = () => {
    // Вызываем событие для обновления счетчика в сайдбаре
    window.dispatchEvent(new CustomEvent('updateUnreadCount'));
  };

  const loadAvailableContacts = async () => {
     try {
       console.log('🔍 Loading available contacts...');
       console.log('👤 Current user:', currentUser);
       const contacts = await getAvailableContacts();
       console.log('📞 Available contacts:', contacts);
       setAvailableContacts(contacts);
     } catch (error) {
       console.error('❌ Failed to load contacts:', error);
     }
   };

  const markSendFailed = (clientId: string) => {
    setMessages(prev => prev.map(m => (m._clientId === clientId ? { ...m, _status: 'failed' } : m)));
  };

  // Enqueue an optimistic bubble, then send it. Over the socket the send is
  // fire-and-forget, so the bubble stays "pending" until the server echoes it back
  // (see reconcileEcho) and flips to "failed" if no echo lands inside the window.
  const deliver = async (content: string, replyToId: number | null) => {
    const clientId = nextClientId();
    const meId = currentUser ? Number(currentUser.id) : 0;
    const replySource = replyToId ? messages.find(m => m.id === replyToId) : undefined;
    const optimistic: ChatMessage = {
      id: -Date.now() - clientMsgCounter, // temporary, never collides with a server id
      from_user_id: meId,
      to_user_id: activePartnerId ?? 0,
      sender_name: currentUser?.name || currentUser?.full_name,
      content,
      is_read: false,
      reply_to_message_id: replyToId,
      reply_preview: replySource
        ? {
            id: replySource.id,
            content: replySource.content,
            file_url: replySource.file_url,
            from_user_id: replySource.from_user_id,
            sender_name: replySource.sender_name,
          }
        : null,
      created_at: new Date().toISOString(),
      _status: 'pending',
      _clientId: clientId,
    };
    setMessages(prev => [...prev, optimistic]);

    const failIfStillPending = () => {
      setMessages(prev => prev.map(m =>
        (m._clientId === clientId && m._status === 'pending' ? { ...m, _status: 'failed' } : m)));
    };

    const socket = connectSocket();
    // Decide failure from the server's ack, never from a wall clock. The handler broadcasts
    // message:new to our OWN room before it returns, and socket.io preserves packet order on
    // a connection, so a send that worked has already reconciled this bubble by the time the
    // ack lands. Still pending when the ack fires therefore means the server rejected it (it
    // answers those with a message:error carrying no id we could correlate). That distinction
    // is what stops a slow-but-successful send from being marked failed and then retried into
    // a duplicate — the server has no content de-dup. The .timeout() is a backstop for the one
    // case that produces no ack at all: the handler raising before its own try block.
    //
    // INVARIANT: this relies on the backend's Socket.IO server using the default IN-PROCESS
    // manager, so the room emit and the ack travel the same connection in order. Adding a
    // client_manager (AsyncRedisManager etc. — which the 4-worker deployment otherwise wants)
    // routes the echo through pub/sub while the ack stays direct, so the ack would beat the
    // echo and EVERY send would look failed. If one is introduced, the backend must return a
    // success payload from the handler and this must switch to reading it.
    const emitWithAck = (event: string, payload: Record<string, unknown>) => {
      socket.timeout(SEND_ACK_TIMEOUT_MS).emit(event, payload, failIfStillPending);
    };

    if (activeGroupConvId) {
      if (socket && socket.connected) {
        emitWithAck('group:message:send', { conversation_id: activeGroupConvId, content });
      } else {
        try {
          const saved = await sendGroupMessage(activeGroupConvId, content);
          setMessages(prev => replacePending(prev, clientId, saved));
        } catch (error) {
          console.error('Failed to send message:', error);
          markSendFailed(clientId);
          return;
        }
      }
      void loadGroupThreads();
      return;
    }

    if (!activePartnerId) return;
    if (socket && socket.connected) {
      emitWithAck('message:send', { to_user_id: activePartnerId, content, reply_to_message_id: replyToId });
    } else {
      try {
        const saved = await sendMessage(String(activePartnerId), content, replyToId);
        setMessages(prev => replacePending(prev, clientId, saved));
      } catch (error) {
        console.error('Failed to send message:', error);
        markSendFailed(clientId);
        return;
      }
    }
    await loadThreads();
    updateUnreadCount();
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || (!activePartnerId && !activeGroupConvId)) return;
    // The optimistic bubble is enqueued synchronously, so clearing the input here is
    // safe — a failed send leaves a retry bubble behind, not a void.
    const content = text.trim();
    const replyToId = replyingTo?.id ?? null;
    setText('');
    setReplyingTo(null);
    void deliver(content, replyToId);
  };

  // Drop the failed bubble and send it again, which enqueues a fresh optimistic one.
  const retrySend = (message: ChatMessage) => {
    setMessages(prev => prev.filter(m => (message._clientId ? m._clientId !== message._clientId : m.id !== message.id)));
    void deliver(message.content, message.reply_to_message_id ?? null);
  };

  const confirmReport = async () => {
    if (reportTargetId === null) return;
    const messageId = reportTargetId;
    setReportTargetId(null);
    try {
      await reportMessage(messageId);
      toast.success('Reported', { description: 'The school administration will review this message.' });
    } catch (error) {
      console.error('Failed to report message:', error);
      toast.error('Could not submit the report', { description: 'Please try again.' });
    }
  };

  // Add/replace/toggle a reaction. Backend toggles same-emoji off, so a single
  // "react with this emoji" call covers add, replace, and remove.
  const applyReaction = async (messageId: number, emoji: string) => {
    const socket = connectSocket();
    if (socket && socket.connected) {
      socket.emit('message:react', { message_id: messageId, emoji });
      return;
    }
    try {
      const res = await reactToMessage(messageId, emoji);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: res.reactions || [] } : m));
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  const toggleMute = async (partnerId: number) => {
    const currentlyMuted = mutedIds.has(partnerId);
    // Optimistic update, reverted on failure.
    setMutedIds(prev => {
      const next = new Set(prev);
      if (currentlyMuted) next.delete(partnerId); else next.add(partnerId);
      return next;
    });
    try {
      if (currentlyMuted) await unmuteConversation(partnerId);
      else await muteConversation(partnerId);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      setMutedIds(prev => {
        const next = new Set(prev);
        if (currentlyMuted) next.add(partnerId); else next.delete(partnerId);
        return next;
      });
    }
  };

  const startNewChat = async (contact: AvailableContact) => {
    setActiveGroupConvId(null);
    setActivePartnerId(contact.user_id);
    setShowNewChatDialog(false);
    
    // Загружаем сообщения с этим контактом
    const msgs: ChatMessage[] = await fetchMessages(String(contact.user_id));
    const ordered = msgs.reverse();
    const firstUnread = ordered.find(m => !m.is_read && m.from_user_id === contact.user_id);
    setFirstUnreadId(firstUnread ? firstUnread.id : null);
    setMessages(ordered);

    // Отмечаем все сообщения от этого партнера как прочитанные
    const socket = connectSocket();
    if (socket && socket.connected) {
      socket.emit('message:read-all', { partner_id: contact.user_id });
    }
    
    // Обновляем список разговоров, чтобы новый чат появился в списке
    await loadThreads();
    
    // Обновляем счетчик непрочитанных сообщений в сайдбаре
    updateUnreadCount();
  };

  const openGroup = async (conv: GroupThread) => {
    setActivePartnerId(null);
    setActiveGroupConvId(conv.id);
    setShowNewChatDialog(false);
    setReplyingTo(null);
    // Group threads carry no per-message read flag, so there is no divider to place.
    setFirstUnreadId(null);

    const msgs: ChatMessage[] = await fetchGroupMessages(conv.id);
    // Group endpoint already returns oldest→newest: do NOT reverse (unlike the DM endpoint).
    setMessages(msgs);

    const socket = connectSocket();
    if (socket && socket.connected) {
      socket.emit('group:read', { conversation_id: conv.id });
    }

    setGroupThreads(prev => prev.map(t => t.id === conv.id ? { ...t, unread_count: 0 } : t));
    await loadThreads();
  };

  const getActivePartner = () => {
    // Сначала ищем в существующих тредах
    const existingPartner = threads.find(t => t.partner_id === activePartnerId);
    if (existingPartner) return existingPartner;
    
    // Если не найден в тредах, ищем в доступных контактах
    return availableContacts.find(c => c.user_id === activePartnerId);
  };

  const getActivePartnerName = () => {
    const partner = getActivePartner();
    if (!partner) return 'Select chat';
    
    // Для MessageThread
    if ('partner_name' in partner) {
      return partner.partner_name;
    }
    
    // Для AvailableContact
    if ('name' in partner) {
      return partner.name;
    }
    
    return 'Unknown user';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Группировка контактов по ролям для студентов
  const getGroupedContacts = () => {
    if (currentUser?.role !== 'student') {
      return { all: availableContacts };
    }

    const filtered = availableContacts.filter(contact => 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
      teachers: filtered.filter(contact => contact.role === 'teacher'),
      admins: filtered.filter(contact => contact.role === 'admin'),
      curators: filtered.filter(contact => contact.role === 'curator'),
      other: filtered.filter(contact => !['teacher', 'admin', 'curator'].includes(contact.role))
    };
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'teacher': return 'Teachers';
      case 'admin': return 'Administrators';
      case 'curator': return 'Curators';
      default: return 'Others';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'teacher': return '';
      case 'admin': return '';
      case 'curator': return '';
      default: return '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-200px)] min-h-0">
      {/* Список разговоров */}
      <Card className="lg:col-span-4 flex flex-col min-h-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            {currentUser?.role === 'student' ? 'Messages' : 'Chats'}
          </CardTitle>
          <Dialog open={showNewChatDialog} onOpenChange={(open) => {
            setShowNewChatDialog(open);
            if (open) {
              loadAvailableContacts();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
              >
                {currentUser?.role === 'student' ? 'Contact' : 'New Chat'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {currentUser?.role === 'student' ? 'Contact Support Team' : 'Select Contact'}
                </DialogTitle>
              </DialogHeader>
              
              {/* Search for contacts */}
              <div className="mb-4 space-y-2">
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              
              </div>

              <div className="max-h-96 overflow-y-auto space-y-4">
                {currentUser?.role === 'student' ? (
                  // Grouped view for students
                  (() => {
                    const grouped = getGroupedContacts();
                    return (
                      <>
                        {/* Teachers Section */}
                        {grouped.teachers && grouped.teachers.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                              {getRoleIcon('teacher')} {getRoleDisplayName('teacher')}
                            </h4>
                            <div className="space-y-1">
                              {grouped.teachers.map(contact => (
                                <div
                                  key={contact.user_id}
                                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                                  onClick={() => startNewChat(contact)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={contact.avatar_url} />
                                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{contact.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Course Teacher</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Curators Section */}
                        {grouped.curators && grouped.curators.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                              {getRoleIcon('curator')} {getRoleDisplayName('curator')}
                            </h4>
                            <div className="space-y-1">
                              {grouped.curators.map(contact => (
                                <div
                                  key={contact.user_id}
                                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                                  onClick={() => startNewChat(contact)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={contact.avatar_url} />
                                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{contact.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Group Curator</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admins Section */}
                        {grouped.admins && grouped.admins.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                              {getRoleIcon('admin')} {getRoleDisplayName('admin')}
                            </h4>
                            <div className="space-y-1">
                              {grouped.admins.map(contact => (
                                <div
                                  key={contact.user_id}
                                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                                  onClick={() => startNewChat(contact)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={contact.avatar_url} />
                                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{contact.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {availableContacts.length === 0 && (
                          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                            <p className="text-sm mb-2">No contacts available</p>
                            <div className="text-xs space-y-1 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border dark:border-gray-700">
                              <p className="font-medium text-blue-800 dark:text-blue-400">To see your contacts, you need:</p>
                              <ul className="text-blue-700 dark:text-blue-400 space-y-1">
                                <li>• Be enrolled in courses</li>
                                <li>• Be assigned to a student group</li>
                                <li>• Have active course teachers</li>
                              </ul>
                              <p className="text-blue-600 dark:text-blue-400 mt-2">Contact your administrator if you don't see any teachers.</p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  // Simple list for non-students
                  <>
                    {availableContacts
                      .filter(contact => 
                        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        contact.role.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(contact => (
                  <div
                    key={contact.user_id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                    onClick={() => startNewChat(contact)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{contact.role}</p>
                    </div>
                  </div>
                ))}
                {availableContacts.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">No available contacts</p>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-0">
          {/* Показываем активный чат, даже если его нет в списке разговоров */}
          {activePartnerId && !threads.find(t => t.partner_id === activePartnerId) && (
            <div className="space-y-1">
              <div
                className="flex items-center space-x-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500 dark:border-blue-800"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={availableContacts.find(c => c.user_id === activePartnerId)?.avatar_url} />
                    <AvatarFallback>
                      {getInitials(availableContacts.find(c => c.user_id === activePartnerId)?.name || '')}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {availableContacts.find(c => c.user_id === activePartnerId)?.name || 'Unknown'}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">New chat</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Start conversation
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {groupThreads.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Группы
              </p>
              {groupThreads.map(conv => (
                <div
                  key={conv.id}
                  className={`flex items-center space-x-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    activeGroupConvId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500 dark:border-blue-800' : ''
                  }`}
                  onClick={() => openGroup(conv)}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(conv.title)}</AvatarFallback>
                    </Avatar>
                    {conv.unread_count > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      {conv.last_message?.created_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conv.last_message?.content || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {threads.length === 0 && !activePartnerId ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No active conversations</p>
              {currentUser?.role === 'student' && (
                <p className="text-xs mt-2">Click "Contact" to start a new conversation</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {threads.map(thread => (
                <div
                  key={thread.partner_id}
                  className={`flex items-center space-x-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    activePartnerId === thread.partner_id ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500 dark:border-blue-800' : ''
                  }`}
                  onClick={() => { setActiveGroupConvId(null); setActivePartnerId(thread.partner_id); }}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={thread.partner_avatar} />
                      <AvatarFallback>{getInitials(thread.partner_name)}</AvatarFallback>
                    </Avatar>
                    {thread.unread_count > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {(thread.is_muted || mutedIds.has(thread.partner_id)) && (
                          <BellOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                        <span className="truncate">{thread.partner_name}</span>
                      </p>
                      {thread.last_message.created_at && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(thread.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {thread.last_message.from_me ? 'You: ' : ''}{thread.last_message.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Область сообщений */}
      <Card className="lg:col-span-8 flex flex-col min-h-0 order-last lg:order-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!activePartnerId}
              onClick={() => { if (activePartnerId) setShowInfo(true); }}
              className={`flex items-center gap-2 min-w-0 text-left ${activePartnerId ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              aria-label={activePartnerId ? 'Open chat info' : undefined}
            >
              <CardTitle className="text-lg font-semibold truncate">
                {activeGroupConvId
                  ? (groupThreads.find(t => t.id === activeGroupConvId)?.title || 'Group')
                  : getActivePartnerName()}
              </CardTitle>
              {activePartnerId && mutedIds.has(activePartnerId) && (
                <BellOff className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>
            {activePartnerId && (
              <Button variant="ghost" size="sm" onClick={() => setShowInfo(true)} aria-label="Chat info">
                <Info className="w-4 h-4" />
              </Button>
            )}
          </div>
          {activePartnerId && (
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {availableContacts.find(c => c.user_id === activePartnerId)?.role
                  || threads.find(t => t.partner_id === activePartnerId)?.partner_role || 'User'}
              </span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                {activePartnerId || activeGroupConvId ? (
                  currentUser?.role === 'student' ?
                    'Start your conversation' :
                    'Start conversation'
                ) : (
                  currentUser?.role === 'student' ?
                    'Select a conversation or click "Contact" to start a new chat' :
                    'Select a chat to start conversation'
                )}
              </div>
            ) : (
              messages.map((message, index) => {
                const previous = messages[index - 1];
                const showDate = index === 0 || !isSameDay(previous.created_at, message.created_at);
                // Групповые сообщения: своё определяем по currentUser (from_user_id — number, User.id — string),
                // без чекмарок прочтения (у GroupMessage нет is_read) и с именем отправителя над чужими бабблами.
                const body = activeGroupConvId ? (() => {
                  const gMsg = message as any;
                  const isMine = gMsg.from_user_id === Number(currentUser?.id);
                  const isPending = message._status === 'pending';
                  const isFailed = message._status === 'failed';
                  return (
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[85%] sm:max-w-[70%]">
                        {!isMine && (
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5 px-1">
                            {gMsg.sender_name}
                          </p>
                        )}
                        <div
                          className={`px-3 py-2 rounded-xl text-sm ${
                            isMine
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-card border dark:border-gray-700 shadow-sm'
                          } ${isPending ? 'opacity-70' : ''} ${isFailed ? 'ring-1 ring-red-500' : ''}`}
                        >
                          {gMsg.file_url && <ChatAttachment fileUrl={gMsg.file_url} />}
                          <div className="flex items-start gap-2">
                            <span className="flex-1">{gMsg.content}</span>
                            <span className={`text-[10px] whitespace-nowrap mt-auto flex items-center gap-0.5 ${
                              isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {formatMessageTime(gMsg.created_at)}
                              {isPending && <span>· sending…</span>}
                              {isFailed && (
                                <button
                                  type="button"
                                  onClick={() => retrySend(message)}
                                  className="font-semibold text-red-200 underline hover:text-white"
                                >
                                  · failed · retry
                                </button>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <ChatMessageBubble
                    message={message}
                    isMine={message.from_user_id !== activePartnerId}
                    currentUserId={currentUser ? Number(currentUser.id) : null}
                    formatTime={formatMessageTime}
                    onReply={setReplyingTo}
                    onReact={applyReaction}
                    onJumpTo={jumpToMessage}
                    onRetry={retrySend}
                    onReport={setReportTargetId}
                    registerRef={registerMessageRef}
                  />
                );

                return (
                  <Fragment key={message._clientId ?? message.id}>
                    {showDate && <DateSeparator label={formatDateSeparator(message.created_at)} />}
                    {message.id === firstUnreadId && <UnreadDivider />}
                    {body}
                  </Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Reply preview above the composer (DM only) */}
          {replyingTo && activePartnerId && (
            <div className="flex items-center gap-2 px-3 sm:px-4 pt-2 border-t dark:border-gray-700">
              <ReplyIcon className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0 border-l-2 border-blue-500 pl-2">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
                  {replyingTo.from_user_id === Number(currentUser?.id) ? 'You' : (replyingTo.sender_name || 'Message')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {replyingTo.content || (replyingTo.file_url ? '📎 Attachment' : '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Cancel reply"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Форма отправки */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                disabled={!activePartnerId && !activeGroupConvId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={!text.trim() || (!activePartnerId && !activeGroupConvId)}
                size="sm"
              >
                Send
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Chat info dialog (participant details, shared media, mute) */}
      {activePartnerId && (
        <ChatInfoDialog
          open={showInfo}
          onOpenChange={setShowInfo}
          partnerId={activePartnerId}
          name={getActivePartnerName()}
          role={availableContacts.find(c => c.user_id === activePartnerId)?.role
            || threads.find(t => t.partner_id === activePartnerId)?.partner_role}
          avatarUrl={availableContacts.find(c => c.user_id === activePartnerId)?.avatar_url
            || threads.find(t => t.partner_id === activePartnerId)?.partner_avatar}
          isMuted={mutedIds.has(activePartnerId)}
          onToggleMute={() => toggleMute(activePartnerId)}
        />
      )}

      {/* Report confirmation (message context menu → Report) */}
      <AlertDialog open={reportTargetId !== null} onOpenChange={(open) => { if (!open) setReportTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report message</AlertDialogTitle>
            <AlertDialogDescription>
              Report this message to the school administration for review?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReport} className="bg-red-600 hover:bg-red-700">
              Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


