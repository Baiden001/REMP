"use client";

import { useEffect } from "react";

// Copies each table's column headings onto its cells (data-label) so that on
// phones the CSS can show every row as a stacked card with labelled values.
export default function TableLabels() {
  useEffect(() => {
    function label(root: ParentNode) {
      root.querySelectorAll<HTMLTableElement>(".table-wrap table").forEach((table) => {
        const headings = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
        table.querySelectorAll("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            const heading = headings[index];
            if (heading && cell.getAttribute("data-label") !== heading) {
              cell.setAttribute("data-label", heading);
            }
          });
        });
      });
    }

    label(document);
    const observer = new MutationObserver(() => label(document));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
