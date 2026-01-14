'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  X,
  ChevronRight,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '@/lib/firebase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn, formatDate } from '@/lib/utils';

interface Notification {
  id: string;
  tenantId: string;
  type: 'hitl_pending' | 'workflow_paused' | 'document_processed' | 'document_failed' | 'approval_needed' | 'deadline_approaching';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface NotificationsPanelProps {
  onNavigate?: (url: string) => void;
}

const SEVERITY_STYLES = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Clock className="w-5 h-5 text-blue-500" />,
    badge: 'bg-blue-100 text-blue-800',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    badge: 'bg-yellow-100 text-yellow-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    badge: 'bg-red-100 text-red-800',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    badge: 'bg-green-100 text-green-800',
  },
};

export function NotificationsPanel({ onNavigate }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    // Listen for notifications
    const notificationsQuery = query(
      collection(firebaseDb, 'notifications'),
      where('tenantId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      // Generate notifications from HITL requests if notifications collection doesn't exist
      generateNotificationsFromHITL(user.uid);
    });

    return () => unsubNotifications();
  }, []);

  const generateNotificationsFromHITL = async (userId: string) => {
    // Fallback: generate notifications from pending HITL requests
    const hitlQuery = query(
      collection(firebaseDb, 'hitlRequests'),
      where('tenantId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubHITL = onSnapshot(hitlQuery, (snapshot) => {
      const hitlNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          tenantId: userId,
          type: 'hitl_pending' as const,
          title: 'Review Required',
          message: data.description || 'A document requires your review',
          severity: data.urgency === 'critical' || data.urgency === 'high' ? 'warning' as const : 'info' as const,
          read: false,
          actionUrl: '/dashboard?tab=review',
          actionLabel: 'Review Now',
          metadata: { requestId: doc.id },
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setNotifications(hitlNotifications);
      setLoading(false);
    });

    return () => unsubHITL();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(firebaseDb, 'notifications', notificationId), {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      // If notifications collection doesn't exist, just remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  const markAllAsRead = async () => {
    for (const notification of notifications) {
      await markAsRead(notification.id);
    }
  };

  const handleAction = (notification: Notification) => {
    if (notification.actionUrl && onNavigate) {
      onNavigate(notification.actionUrl);
    }
    markAsRead(notification.id);
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white border rounded-lg shadow-xl z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(notification => {
                    const styles = SEVERITY_STYLES[notification.severity];
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 hover:bg-gray-50 cursor-pointer transition-colors',
                          !notification.read && styles.bg
                        )}
                        onClick={() => handleAction(notification)}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {styles.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {notification.title}
                              </span>
                              <Badge className={cn('text-xs', styles.badge)}>
                                {notification.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                {formatDate(notification.createdAt)}
                              </span>
                              {notification.actionLabel && (
                                <span className="text-xs text-primary font-medium flex items-center gap-1">
                                  {notification.actionLabel}
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-gray-50 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (onNavigate) onNavigate('/dashboard?tab=review');
                    setIsOpen(false);
                  }}
                >
                  View All Notifications
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Compact version for embedding in other components
export function NotificationsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    const q = query(
      collection(firebaseDb, 'hitlRequests'),
      where('tenantId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  if (count === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      {count} pending
    </Badge>
  );
}
