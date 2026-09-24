"use client";

export default function DocumentActions({ printLabel }: { printLabel: string }) {
  return (
    <div className="receipt-actions">
      <button className="button ghost" type="button" onClick={() => window.history.back()}>
        ← Back
      </button>

      <button className="button primary" type="button" onClick={() => window.print()}>
        {printLabel}
      </button>
    </div>
  );
}
