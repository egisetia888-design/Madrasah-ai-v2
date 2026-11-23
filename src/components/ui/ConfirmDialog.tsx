import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="text-sm text-gray-600 leading-relaxed">{description}</div>
      </DialogContent>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={isLoading}
          onClick={() => onOpenChange(false)}
          className="w-full sm:w-auto"
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          disabled={isLoading}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white"
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
