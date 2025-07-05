import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-lg', etc
}

export function Modal({ isOpen, onClose, title, subtitle, icon, children, footer, maxWidth = 'max-w-2xl' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
    const focusable = contentRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Return focus to trigger
  useEffect(() => {
    if (!isOpen && previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus();
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        contentRef.current &&
        e.target instanceof Node &&
        overlayRef.current.contains(e.target) &&
        !contentRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity animate-fadeIn"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <div
        ref={contentRef}
        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full min-w-[600px] max-w-[900px] !w-full !max-w-[900px] !min-w-[600px] max-h-[90vh] h-full p-0 relative animate-modalIn flex flex-col outline-none`}
        role="document"
      >
        {/* Header */}
        {(title || subtitle || icon) && (
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center space-x-3">
              {icon && (
                <span className="flex-shrink-0">
                  <span className='inline-flex items-center justify-center w-9 h-9'>
                    {React.isValidElement(icon)
                      ? React.cloneElement(icon as React.ReactElement<any, any>, {
                          className: [(icon as React.ReactElement<any, any>).props.className, 'w-9 h-9 text-gray-400'].filter(Boolean).join(' ')
                        })
                      : icon}
                  </span>
                </span>
              )}
              <div className="flex flex-col justify-center">
                {title && <h2 className="text-2xl font-semibold text-gray-900 dark:text-white leading-tight">{title}</h2>}
                {subtitle && <p className="text-base text-gray-600 dark:text-gray-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-0 px-5 pb-5 space-y-4 text-gray-900 dark:text-white">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="px-8 pb-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end sticky bottom-0 bg-white dark:bg-gray-900 z-10 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    typeof window !== "undefined" ? document.body : (null as any)
  );
}

// Animations (add to global CSS or Tailwind config):
// .animate-fadeIn { animation: fadeIn 0.2s ease; }
// .animate-modalIn { animation: modalIn 0.2s cubic-bezier(0.4,0,0.2,1); }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } } 