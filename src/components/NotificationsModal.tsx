import React from 'react';
import { PortalNotification } from '../types';
import { Bell, X, AlertTriangle, Clock, CheckCircle, Info, Sparkles } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PortalNotification[];
  onMarkAllAsRead: () => void;
  onSelectTenderById?: (tenderId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onSelectTenderById,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-stone-200 p-6 sm:p-7 shadow-2xl text-stone-900 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4d6b2f]/15 text-[#4d6b2f] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">Tender Intelligence & Price Alerts</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-[#4d6b2f] hover:text-[#3f5724] font-bold"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="mt-4 overflow-y-auto space-y-3 pr-1 divide-y divide-stone-100">
          {notifications.map((n) => {
            const isUnread = !n.read;
            return (
              <div
                key={n.id}
                className={`pt-3 first:pt-0 p-3.5 rounded-2xl transition ${
                  isUnread ? 'bg-[#4d6b2f]/8 border border-[#4d6b2f]/25 shadow-2xs' : 'bg-stone-50 border border-stone-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {n.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : n.severity === 'critical' ? (
                      <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : n.severity === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-[#4d6b2f] shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-[#4d6b2f] shrink-0" />
                    )}
                    <h4 className="font-bold text-xs text-stone-900">{n.title}</h4>
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono shrink-0">{n.timestamp}</span>
                </div>

                <p className="text-xs text-stone-600 mt-1 pl-6 leading-relaxed">{n.message}</p>

                {n.tenderId && onSelectTenderById && (
                  <div className="mt-2 pl-6">
                    <button
                      onClick={() => {
                        onSelectTenderById(n.tenderId!);
                        onClose();
                      }}
                      className="text-[11px] font-bold text-[#4d6b2f] hover:text-[#3f5724] flex items-center gap-1"
                    >
                      <span>Inspect Affected Bid ({n.tenderId}) &rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
