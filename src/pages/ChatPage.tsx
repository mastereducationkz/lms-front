import { useEffect, useRef, useState, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticated, fetchThreads, fetchMessages, getAvailableContacts, sendMessage, getCurrentUser } from "../services/api";
import type { MessageThread, Message, AvailableContact, User } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Check } from 'lucide-react';
import { connectSocket } from '../services/socket';

export default function ChatPage() {
  const location = useLocation();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState<string>('');
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const pollRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загрузка пользователя и списка разговоров
  useEffect(() => {
    loadCurrentUser();
    loadThreads();
    loadAvailableContacts();
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
        setMessages(prev => [...prev, payload]);
      }
    };

    const onMessageUpdated = (payload: any) => {
      setMessages(prev => prev.map(m => m.id === payload.id ? { ...m, is_read: payload.is_read } : m));
    };

    const onMessageBulkUpdated = (payload: any) => {
      const ids: number[] = payload?.ids || [];
      const is_read = !!payload?.is_read;
      if (ids.length) setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, is_read } : m));
    };

    const onThreadsUpdate = async () => {
      await loadThreads();
    };

    const onUnreadUpdate = () => {
      updateUnreadCount();
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:bulk-updated', onMessageBulkUpdated);
    socket.on('threads:update', onThreadsUpdate);
    socket.on('unread:update', onUnreadUpdate);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:bulk-updated', onMessageBulkUpdated);
      socket.off('threads:update', onThreadsUpdate);
      socket.off('unread:update', onUnreadUpdate);
    };
  }, [activePartnerId]);

  // Загрузка сообщений при смене активного партнера
  useEffect(() => {
    if (!activePartnerId) return;
    
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

  // Автообновление списка разговоров
  useEffect(() => {
    const interval = setInterval(loadThreads, 10000);
    return () => clearInterval(interval);
  }, []);

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
    if (!text.trim() || !activePartnerId) return;
    
    setIsLoading(true);
    try {
      const optimistic = text.trim();
      setText('');
      const socket = connectSocket();
      if (socket && socket.connected) {
        socket.emit('message:send', { to_user_id: activePartnerId, content: optimistic });
      } else {
        await sendMessage(String(activePartnerId), optimistic);
      }
      await loadThreads();
      updateUnreadCount();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = async (contact: AvailableContact) => {
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
                  {currentUser?.role === 'student' ? 'Contact Teachers & Admins' : 'Select Contact'}
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
          
          {threads.length === 0 && !activePartnerId ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No active conversations</p>
              {currentUser?.role === 'student' && (
                <p className="text-xs mt-2">Click "Contact" to message your teachers or administrators</p>
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
                  onClick={() => setActivePartnerId(thread.partner_id)}
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
                      <p className="text-sm font-medium truncate">{thread.partner_name}</p>
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
          <CardTitle className="text-lg font-semibold">
            {getActivePartnerName()}
          </CardTitle>
          {activePartnerId && (
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {availableContacts.find(c => c.user_id === activePartnerId)?.role || 'User'}
              </span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                {activePartnerId ? (
                  currentUser?.role === 'student' ? 
                    'Start your conversation' : 
                    'Start conversation'
                ) : (
                  currentUser?.role === 'student' ? 
                    'Select a conversation or click "Contact" to reach teachers & admins' : 
                    'Select a chat to start conversation'
                )}
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.from_user_id === activePartnerId ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[70%]`}>
                    <div
                      className={`px-3 py-2 rounded-xl text-sm ${
                        message.from_user_id === activePartnerId
                          ? 'bg-white dark:bg-card border dark:border-gray-700 shadow-sm'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-1">{message.content}</span>
                        <span className={`text-[10px] whitespace-nowrap mt-auto flex items-center gap-0.5 ${
                          message.from_user_id === activePartnerId ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100'
                        }`}>
                          {formatTime(message.created_at)}
                          {message.from_user_id !== activePartnerId && (
                            <span className="relative inline-flex items-center text-white">
                              {message.is_read ? (
                                <>
                                  <Check className="w-3 h-3" strokeWidth={2.5} />
                                  <Check className="w-3 h-3 -ml-1.5" strokeWidth={2.5} />
                                </>
                              ) : (
                                <Check className="w-3 h-3" strokeWidth={2.5} />
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Форма отправки */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                disabled={!activePartnerId || isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button 
                type="submit" 
                disabled={!text.trim() || !activePartnerId || isLoading}
                size="sm"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


