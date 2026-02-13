import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { 
  Bell, 
  BellRing, 
  Check, 
  Trash2, 
  X,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  MessageSquare,
  Heart,
  UserPlus,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';

// No mock notifications — bell starts empty until real backend notifications are wired up
const mockNotifications = [];

const NotificationBell = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Calculate unread count
    const unread = notifications.filter(n => !n.is_read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const markAsRead = (notificationIds = [], markAll = false) => {
    if (markAll) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } else {
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
    }
  };

  const deleteNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationColor = (color, isRead) => {
    const colors = {
      blue: isRead ? 'text-[#7b8fc7]' : 'text-[#1a3aa3]',
      red: isRead ? 'text-red-400' : 'text-red-600',
      green: isRead ? 'text-green-400' : 'text-green-600',
      purple: isRead ? 'text-purple-400' : 'text-purple-600',
      yellow: isRead ? 'text-yellow-400' : 'text-yellow-600',
    };
    return colors[color] || colors.blue;
  };

  const getNotificationBgColor = (isRead) => {
    return isRead ? 'bg-background' : 'bg-muted/50';
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-white hover:bg-white/10 hover:text-[#dde4f5] transition-colors duration-200"
        >
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs border-2 border-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Ειδοποιήσεις</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAsRead([], true)}
                  className="text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Όλα ως αναγνωσμένα
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Δεν υπάρχουν ειδοποιήσεις</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const IconComponent = notification.icon;
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors ${getNotificationBgColor(notification.is_read)}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`mt-1 ${getNotificationColor(notification.color, notification.is_read)}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.is_read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead([notification.id])}
                                className="h-6 w-6 p-0"
                                title="Σήμανση ως αναγνωσμένο"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteNotification(notification.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              title="Διαγραφή"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className={`text-xs mt-1 ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.message}
                        </p>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(notification.timestamp, { 
                            addSuffix: true, 
                            locale: el 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  // In a real app, this would navigate to a full notifications page
                  console.log('Navigate to all notifications');
                }}
              >
                Προβολή όλων των ειδοποιήσεων
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;