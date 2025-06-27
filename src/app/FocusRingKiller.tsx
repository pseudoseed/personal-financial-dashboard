"use client";
import { useEffect } from "react";

const RING_CLASSES = [
  "focus:ring-2",
  "focus:ring-primary-500",
  "focus:ring-offset-2",
  "dark:focus:ring-offset-surface-900",
  "focus:ring-1",
  "focus:ring-4",
  "focus:ring-8",
  "focus:ring-0",
  "focus:ring-offset-0"
];

export default function FocusRingKiller() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target && target instanceof HTMLElement) {
          RING_CLASSES.forEach((cls) => target.classList.remove(cls));
          target.classList.add("focus:ring-0", "focus:ring-offset-0");
          target.style.outline = "none";
          target.style.boxShadow = "none";
          target.style.borderColor = "";
        }
      });
    }
  }, []);
  return null;
} 