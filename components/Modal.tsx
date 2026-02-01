"use client";

import React from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
};

export default function Modal({ open, title, description, children, onClose, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">{title}</div>
          {description ? <div className="mt-1 text-sm text-gray-500">{description}</div> : null}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-gray-100">{footer}</div> : null}
      </div>
    </div>
  );
}

