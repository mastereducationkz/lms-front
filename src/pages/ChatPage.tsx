import { useEffect, useRef, useState, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticated, fetchThreads, fetchMessages, getAvailableContacts, sendMessage, getCurrentUser, fetchGroupThreads, fetchGroupMessages, sendGroupMessage, reactToMessage, getMutedConversations, muteConversation, unmuteConversation } from "../services/api";
import type { MessageThread, Message, AvailableContact, User, GroupThread } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { BellOff, Info, Reply as ReplyIcon, X } from 'lucide-react';
import { connectSocket } from '../services/socket';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import { ChatAttachment } from '../components/chat/ChatAttachment';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatInfoDialog } from '../components/chat/ChatInfoDialog';

export default function ChatPage() {
  const location = useLocation();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [groupThreads, setGroupThreads] = useState<GroupThread[]>([]);
  const [activeGroupConvId, setActiveGroupConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState<string>('');
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mutedIds, setMutedIds] = useState<Set<number>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
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
        setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
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
        setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
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
      const msgs: any[] = await fetchMessages(String(activePartnerId));
      setMessages(msgs.reverse());
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

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || (!activePartnerId && !activeGroupConvId)) return;

    setIsLoading(true);
    try {
      const optimistic = text.trim();
      const replyToId = replyingTo?.id ?? null;
      setText('');
      setReplyingTo(null);
      const socket = connectSocket();

      if (activeGroupConvId) {
        if (socket && socket.connected) {
          socket.emit('group:message:send', { conversation_id: activeGroupConvId, content: optimistic });
        } else {
          await sendGroupMessage(activeGroupConvId, optimistic);
        }
        void loadGroupThreads();
      } else if (activePartnerId) {
        if (socket && socket.connected) {
          socket.emit('message:send', { to_user_id: activePartnerId, content: optimistic, reply_to_message_id: replyToId });
        } else {
          await sendMessage(String(activePartnerId), optimistic, replyToId);
        }
        await loadThreads();
        updateUnreadCount();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
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
    const msgs: any[] = await fetchMessages(String(contact.user_id));
    setMessages(msgs.reverse());
    
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

    const msgs: any[] = await fetchGroupMessages(conv.id);
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
              messages.map(message => {
                // Групповые сообщения: своё определяем по currentUser (from_user_id — number, User.id — string),
                // без чекмарок прочтения (у GroupMessage нет is_read) и с именем отправителя над чужими бабблами.
                if (activeGroupConvId) {
                  const gMsg = message as any;
                  const isMine = gMsg.from_user_id === Number(currentUser?.id);
                  return (
                    <div
                      key={gMsg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
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
                          }`}
                        >
                          {gMsg.file_url && <ChatAttachment fileUrl={gMsg.file_url} />}
                          <div className="flex items-start gap-2">
                            <span className="flex-1">{gMsg.content}</span>
                            <span className={`text-[10px] whitespace-nowrap mt-auto ${
                              isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {formatTime(gMsg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    isMine={message.from_user_id !== activePartnerId}
                    currentUserId={currentUser ? Number(currentUser.id) : null}
                    formatTime={formatTime}
                    onReply={setReplyingTo}
                    onReact={applyReaction}
                    onJumpTo={jumpToMessage}
                    registerRef={registerMessageRef}
                  />
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
                disabled={(!activePartnerId && !activeGroupConvId) || isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={!text.trim() || (!activePartnerId && !activeGroupConvId) || isLoading}
                size="sm"
              >
                {isLoading ? 'Sending...' : 'Send'}
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
    </div>
  );
}


