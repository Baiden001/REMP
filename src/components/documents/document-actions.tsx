
"use client";

import { useEffect } from "react";
import Icon from "@/components/icon";

// Scales the document to fit the available screen width.
function useFitDocumentToScreen() {
  useEffect(() => {
    function fit() {
      const doc = document.querySelector<HTMLElement>(
        ".payment-receipt-a4"
      );

      if (!doc) return;

      const page = doc.parentElement;
      const available =
        (page?.clientWidth ?? window.innerWidth) - 28;

      const a4Width = 794;
      const scale = Math.min(1, available / a4Width);

      doc.style.setProperty("--doc-scale", String(scale));
      doc.classList.toggle("is-scaled", scale < 1);
    }

    fit();
    window.addEventListener("resize", fit);

    return () => window.removeEventListener("resize", fit);
  }, []);
}

// Automatically scales long documents to fit one A4 page.
function useFitDocumentForPrint() {
  useEffect(() => {
    function preparePrint() {
      const doc = document.querySelector<HTMLElement>(
        ".payment-receipt-a4"
      );

      if (!doc) return;

      // Remove previous scaling before measuring.
      doc.style.zoom = "1";

      const a4Height = (297 / 25.4) * 96;
      const safetySpace = 8;

      const contentHeight = Math.max(
        doc.scrollHeight,
        doc.getBoundingClientRect().height
      );

      const scale = Math.min(
        1,
        (a4Height - safetySpace) / contentHeight
      );

      doc.style.zoom = String(scale);
      doc.style.margin = "0 auto";
    }

    function restoreAfterPrint() {
      const doc = document.querySelector<HTMLElement>(
        ".payment-receipt-a4"
      );

      if (!doc) return;

      doc.style.removeProperty("zoom");
      doc.style.removeProperty("margin");
    }

    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", restoreAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", preparePrint);
      window.removeEventListener("afterprint", restoreAfterPrint);
      restoreAfterPrint();
    };
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
  useFitDocumentForPrint();

  return (
    <div className="receipt-actions">
      {showBack && (
        <button
          className="button ghost"
          type="button"
          onClick={() => window.history.back()}
        >
          <Icon name="arrowLeft" size={15} /> Back
        </button>
      )}

      {children}

      <button
        className="button primary"
        type="button"
        onClick={() => window.print()}
      >
        {printLabel}
      </button>
    </div>
  );
}
