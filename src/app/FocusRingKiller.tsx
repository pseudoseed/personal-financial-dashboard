"use client";
import { useEffect } from "react";

export default function FocusRingKiller() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.addEventListener("focusin", (e) => {
        if (e.target instanceof HTMLElement) {
          e.target.style.outline = "none";
          e.target.style.boxShadow = "none";
          e.target.style.borderColor = "";
        }
      });
    }
  }, []);
  return null;
} 