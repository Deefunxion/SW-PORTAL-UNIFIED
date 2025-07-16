import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Circle, 
  Clock, 
  Minus, 
  X,
  Wifi,
  WifiOff
} from 'lucide-react';
import api from '@/lib/api';

/**
 * User Presence Indicator Component
 * Shows online/offline status with visual indicators
 */
function UserPresenceIndicator({ 
  userId, 
  username, 
  size = 'sm', 
  showLabel = false, 
  showLastSeen = false,
  className = '',
  realTime = false 
}) {
  const [presence, setPresence] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchPresence();
      
      // Set up real-time updates if enabled
      if (realTime) {
        const interval = setInterval(fetchPresence, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
      }
    }
  }, [userId, realTime]);

  const fetchPresence = async () => {
    try {
      const { data } = await api.get(`/api/users/${userId}/presence`);
      setPresence(data.presence);
    } catch (error) {
      console.error('Error fetching presence:', error);
      setPresence({
        status: 'offline',
        last_seen: null,
        is_online: false
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-500',
          icon: Circle,
          label: 'Συνδεδεμένος',
          textColor: 'text-green-600'
        };
      case 'away':
        return {
          color: 'bg-yellow-500',
          icon: Clock,
          label: 'Απών',
          textColor: 'text-yellow-600'
        };
      case 'busy':
        return {
          color: 'bg-red-500',
          icon: Minus,
          label: 'Απασχολημένος',
          textColor: 'text-red-600'
        };
      case 'offline':
      default:
        return {
          color: 'bg-gray-400',
          icon: Circle,
          label: 'Αποσυνδεδεμένος',
          textColor: 'text-gray-500'
        };
    }
  };

  const formatLastSeen = (lastSeenString) => {
    if (!lastSeenString) return 'Ποτέ';
    
    const lastSeen = new Date(lastSeenString);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Μόλις τώρα';
    if (diffMins < 60) return `Πριν ${diffMins} λεπτά`;
    if (diffHours < 24) return `Πριν ${diffHours} ώρες`;
    if (diffDays < 7) return `Πριν ${diffDays} μέρες`;
    
    return lastSeen.toLocaleDateString('el-GR', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded-full h-3 w-3"></div>
        {showLabel && (
          <div className="animate-pulse bg-gray-200 rounded h-4 w-16 ml-2"></div>
        )}
      </div>
    );
  }

  if (!presence) return null;

  const statusInfo = getStatusInfo(presence.status);
  const Icon = statusInfo.icon;

  // Determine indicator size
  const sizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const iconSizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  if (size === 'xs' && !showLabel) {
    return (
      <div className={`relative inline-block ${className}`}>
        <div className={`${sizeClasses[size]} ${statusInfo.color} rounded-full`} />
      </div>
    );
  }

  if (size === 'badge') {
    return (
      <Badge 
        variant="secondary" 
        className={`inline-flex items-center space-x-1 ${statusInfo.textColor} bg-opacity-10 border-0 ${className}`}
      >
        <div className={`${sizeClasses.sm} ${statusInfo.color} rounded-full`} />
        <span className="text-xs font-medium">{statusInfo.label}</span>
      </Badge>
    );
  }

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} ${statusInfo.color} rounded-full flex items-center justify-center`}>
          {presence.status === 'busy' && (
            <Minus className={`${iconSizeClasses.xs} text-white`} />
          )}
        </div>
        
        {/* Pulse animation for online status */}
        {presence.status === 'online' && (
          <div className={`absolute inset-0 ${statusInfo.color} rounded-full animate-ping opacity-75`} />
        )}
      </div>

      {showLabel && (
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${statusInfo.textColor}`}>
            {statusInfo.label}
          </span>
          {showLastSeen && presence.status === 'offline' && (
            <span className="text-xs text-gray-500">
              {formatLastSeen(presence.last_seen)}
            </span>
          )}
          {presence.custom_status && (
            <span className="text-xs text-gray-600 italic">
              {presence.custom_status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * User Avatar with Presence Indicator
 */
function UserAvatarWithPresence({ 
  userId, 
  username, 
  size = 'md', 
  showPresence = true,
  className = '' 
}) {
  const [presence, setPresence] = useState(null);

  useEffect(() => {
    if (userId && showPresence) {
      fetchPresence();
    }
  }, [userId, showPresence]);

  const fetchPresence = async () => {
    try {
      const { data } = await api.get(`/api/users/${userId}/presence`);
      setPresence(data.presence);
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  };

  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl'
  };

  const presenceSizes = {
    sm: 'h-2.5 w-2.5 border',
    md: 'h-3 w-3 border-2',
    lg: 'h-3.5 w-3.5 border-2',
    xl: 'h-4 w-4 border-2'
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Avatar */}
      <div className={`
        ${sizeClasses[size]} 
        bg-blue-500 rounded-full flex items-center justify-center text-white font-medium
      `}>
        {username?.charAt(0).toUpperCase() || 'U'}
      </div>

      {/* Presence Indicator */}
      {showPresence && presence && (
        <div className={`
          absolute bottom-0 right-0 
          ${presenceSizes[size]} 
          ${getStatusColor(presence.status)} 
          rounded-full border-white
        `} />
      )}
    </div>
  );
}

/**
 * Presence Status Selector Component
 */
function PresenceStatusSelector({ 
  currentStatus = 'online', 
  onStatusChange, 
  disabled = false 
}) {
  const [customStatus, setCustomStatus] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const statusOptions = [
    { value: 'online', label: 'Συνδεδεμένος', color: 'bg-green-500', icon: Circle },
    { value: 'away', label: 'Απών', color: 'bg-yellow-500', icon: Clock },
    { value: 'busy', label: 'Απασχολημένος', color: 'bg-red-500', icon: Minus },
    { value: 'offline', label: 'Αποσυνδεδεμένος', color: 'bg-gray-400', icon: X }
  ];

  const handleStatusChange = async (status) => {
    try {
      await api.post('/api/users/presence', {
        status,
        custom_status: customStatus || null
      });
      
      if (onStatusChange) {
        onStatusChange(status, customStatus);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleCustomStatusSubmit = () => {
    handleStatusChange(currentStatus);
    setShowCustomInput(false);
  };

  return (
    <div className="space-y-3">
      {/* Status Options */}
      <div className="space-y-2">
        {statusOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              disabled={disabled}
              className={`
                w-full flex items-center space-x-3 p-2 rounded-lg transition-colors
                ${currentStatus === option.value 
                  ? 'bg-blue-50 border-2 border-blue-200' 
                  : 'hover:bg-gray-50 border-2 border-transparent'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`h-3 w-3 ${option.color} rounded-full flex items-center justify-center`}>
                {option.value === 'busy' && (
                  <Minus className="h-2 w-2 text-white" />
                )}
              </div>
              <span className="font-medium">{option.label}</span>
              {currentStatus === option.value && (
                <div className="ml-auto">
                  <Circle className="h-4 w-4 text-blue-500 fill-current" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Status */}
      <div className="border-t pt-3">
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="w-full text-left text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            + Προσθήκη προσωπικού μηνύματος
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="Προσωπικό μήνυμα κατάστασης..."
              className="w-full p-2 border rounded-md text-sm"
              maxLength={100}
              disabled={disabled}
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCustomStatusSubmit}
                disabled={disabled}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
              >
                Αποθήκευση
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomStatus('');
                }}
                disabled={disabled}
                className="px-3 py-1 text-gray-600 rounded text-sm hover:text-gray-800 transition-colors"
              >
                Ακύρωση
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Online Users List Component
 */
function OnlineUsersList({ 
  users = [], 
  onUserClick, 
  className = '' 
}) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const fetchOnlineUsers = async () => {
    try {
      const { data } = await api.get('/api/users/online');
      setOnlineUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching online users:', error);
      setOnlineUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center space-x-3">
            <div className="bg-gray-200 rounded-full h-8 w-8"></div>
            <div className="bg-gray-200 rounded h-4 w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  if (onlineUsers.length === 0) {
    return (
      <div className={`text-center py-4 text-gray-500 ${className}`}>
        <WifiOff className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Κανένας χρήστης online</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <Wifi className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-gray-700">
          Online ({onlineUsers.length})
        </span>
      </div>
      
      {onlineUsers.map((user) => (
        <button
          key={user.id}
          onClick={() => onUserClick && onUserClick(user)}
          className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <UserAvatarWithPresence
            userId={user.id}
            username={user.username}
            size="sm"
            showPresence={true}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.username}</p>
            {user.presence?.custom_status && (
              <p className="text-xs text-gray-500 truncate italic">
                {user.presence.custom_status}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default UserPresenceIndicator;
export { 
  UserAvatarWithPresence, 
  PresenceStatusSelector, 
  OnlineUsersList 
};

