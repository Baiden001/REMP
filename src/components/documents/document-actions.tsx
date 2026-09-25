"use client";

import { useEffect } from "react";
import Icon from "@/components/icon";

// Shrinks the A4 document to fit narrow screens (print is unaffected).
function useFitDocumentToScreen() {
  useEffect(() => {
    function fit() {
      const doc = document.querySelector<HTMLElement>(".payment-receipt-a4");
      if (!doc) return;
      const page = doc.parentElement;
      const available = (page?.clientWidth ?? window.innerWidth) - 28;
      const a4Width = 794; // 210mm at 96dpi
      const scale = Math.min(1, available / a4Width);
      doc.style.setProperty("--doc-scale", String(scale));
      doc.classList.toggle("is-scaled", scale < 1);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
}

export default function DocumentActions({
  printLabel,
  showBack = true,
  children,
}: {
  printLabel: string;
  showBack?: boolean;
  children?: React.ReactNode;
}) {
  useFitDocumentToScreen();

  return (
    <div className="receipt-actions">
      {showBack && (
        <button className="button ghost" type="button" onClick={() => window.history.back()}>
          <Icon name="arrowLeft" size={15} /> Back
        </button>
      )}

      {children}

      <button className="button primary" type="button" onClick={() => window.print()}>
        {printLabel}
      </button>
    </div>
  );
}
