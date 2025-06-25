import { useEffect, useRef, useCallback } from 'react';

interface UseDialogDismissOptions {
  isOpen: boolean;
  onClose: () => void;
  allowEscape?: boolean;
  allowClickOutside?: boolean;
  requireInput?: boolean;
}

export function useDialogDismiss({
  isOpen,
  onClose,
  allowEscape = true,
  allowClickOutside = true,
  requireInput = false,
}: UseDialogDismissOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen && allowEscape && !requireInput) {
      onClose();
    }
  }, [isOpen, allowEscape, requireInput, onClose]);

  // Handle click outside
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      isOpen &&
      allowClickOutside &&
      !requireInput &&
      dialogRef.current &&
      !dialogRef.current.contains(event.target as Node)
    ) {
      onClose();
    }
  }, [isOpen, allowClickOutside, requireInput, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Add event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleEscapeKey, handleClickOutside]);

  return dialogRef;
} 