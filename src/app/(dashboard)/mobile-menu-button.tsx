"use client";

import { useState, useEffect } from "react";

export default function MobileMenuButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sidebar = document.querySelector(".sidebar") as HTMLElement | null;
    if (!sidebar) return;
    if (open) {
      sidebar.classList.add("open");
    } else {
      sidebar.classList.remove("open");
    }
  }, [open]);

  // Close sidebar when navigating (clicking a nav link)
  useEffect(() => {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    function handleClick(e: Event) {
      const target = e.target as HTMLElement;
      if (target.closest(".nav-item")) setOpen(false);
    }
    sidebar.addEventListener("click", handleClick);
    return () => sidebar.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      <button
        className="menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#31506f" }}
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Backdrop to close sidebar on tap outside */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 19,
            background: "rgba(6,25,48,.35)",
          }}
        />
      )}
    </>
  );
}
