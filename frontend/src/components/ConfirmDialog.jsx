import React, { useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className={`max-w-md w-full sw-card p-6 space-y-5 ${danger ? 'border-coral/40' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {danger && <AlertTriangle className="w-6 h-6 text-coral shrink-0" />}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <button type="button" onClick={onCancel} className="sw-btn p-2" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {message && <p className="text-sm text-muted leading-relaxed">{message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="sw-btn">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`sw-btn ${danger ? 'border-coral/40 text-coral' : 'sw-btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        title: 'Please confirm',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        danger: false,
        ...options,
        resolve,
      });
    });
  }, []);

  const close = (value) => {
    if (state?.resolve) state.resolve(value);
    setState(null);
  };

  const dialog = (
    <ConfirmDialog
      isOpen={Boolean(state)}
      title={state?.title}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      danger={state?.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return [confirm, dialog];
}
