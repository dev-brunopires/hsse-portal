import * as React from "react";

import { toast as sonnerToast } from "@/components/ui/sonner";

// Compatibility layer: keep the existing shadcn-style API (`useToast` + `toast({title, description, variant})`)
// but back it with Sonner to avoid React state/listener edge cases.

type ToastVariant = "default" | "destructive";

export type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
};

function normalizeToString(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  return "";
}

export function toast({ title, description, variant }: ToastInput) {
  const titleStr = normalizeToString(title);
  const descriptionStr = normalizeToString(description);

  const message = title ?? description ?? "";
  const opts = title ? { description: descriptionStr || undefined } : undefined;

  if (variant === "destructive") {
    return sonnerToast.error(message, opts);
  }

  return sonnerToast(message, opts);
}

export function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) sonnerToast.dismiss(toastId);
      else sonnerToast.dismiss();
    },
  };
}

