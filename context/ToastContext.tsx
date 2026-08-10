'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container overlay */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-surface border border-border text-primary-text text-xs p-3.5 rounded-[8px] shadow-2xl flex items-start justify-between gap-3 animate-slide-in relative overflow-hidden backdrop-blur-sm"
            role="alert"
          >
            {/* Color Accent Indicator Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              toast.type === 'success' ? 'bg-healthy-text' :
              toast.type === 'warning' ? 'bg-warning-text' :
              toast.type === 'error' ? 'bg-critical-text' :
              'bg-info-text'
            }`} />
            
            <div className="flex items-start gap-2.5 pl-1.5 flex-1">
              <span className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-healthy-text" />}
                {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-warning-text" />}
                {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-critical-text" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-info-text" />}
              </span>
              <p className="font-semibold leading-relaxed break-words">{toast.message}</p>
            </div>
            
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-muted hover:text-primary-text transition-colors p-0.5 rounded focus:outline-none shrink-0 cursor-pointer"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
