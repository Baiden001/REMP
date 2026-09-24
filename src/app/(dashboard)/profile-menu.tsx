"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileMenuProps = {
  userId: string;
  fullName: string;
  role: string;
  phone: string;
  avatarUrl: string | null;
};

export default function ProfileMenu({
  userId,
  fullName,
  role,
  phone,
  avatarUrl,
}: ProfileMenuProps) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(fullName);
    setPhoneNumber(phone);
    setAvatar(avatarUrl);
  }, [fullName, phone, avatarUrl]);

  function initials(value: string) {
    return value
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  async function handleAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const {
  data: { user },
} = await supabase.auth.getUser();

console.log("Avatar upload user:", user?.id);

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5MB.");
      return;
    }

    setMessage("");

    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    setAvatar(publicUrl);
    setMessage("Profile picture updated.");
  }

  async function saveProfile() {
    if (!name.trim()) {
      setMessage("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        phone: phoneNumber.trim() || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Profile updated successfully.");

    setTimeout(() => {
      window.location.reload();
    }, 700);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="top-avatar avatar avatar-ceo"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open profile"
        style={{
          overflow: "hidden",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          initials(name)
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
            }}
          />

          <div
            className="topbar-dropdown"
            style={{
              position: "absolute",
              top: 44,
              right: 0,
              width: 310,
              background: "#fff",
              border: "1px solid #eaefec",
              borderRadius: 14,
              boxShadow: "0 16px 45px rgba(21,46,36,.16)",
              zIndex: 81,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 18px 14px",
                borderBottom: "1px solid #f1f6f4",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    border: "1px solid #e0e8e5",
                    background: avatar ? "#fff" : "#f2fbf7",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    padding: 0,
                    color: "#1f5a44",
                    fontWeight: 700,
                  }}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    initials(name)
                  )}
                </button>

                <div>
                  <b
                    style={{
                      display: "block",
                      fontSize: 13,
                      color: "#11251d",
                    }}
                  >
                    {name}
                  </b>

                  <small
                    style={{
                      fontSize: 10,
                      color: "#8e9e98",
                      textTransform: "capitalize",
                    }}
                  >
                    {role} · Profile
                  </small>

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      display: "block",
                      marginTop: 4,
                      padding: 0,
                      border: "none",
                      background: "none",
                      color: "#1f5a44",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    Change photo
                  </button>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />
            </div>

            <div style={{ padding: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "#61786f",
                }}
              >
                FULL NAME
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 10px",
                  border: "1px solid #e0e8e5",
                  borderRadius: 8,
                  outline: "none",
                  fontSize: 12,
                  marginBottom: 13,
                }}
              />

              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "#61786f",
                }}
              >
                PHONE NUMBER
              </label>

              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+233..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 10px",
                  border: "1px solid #e0e8e5",
                  borderRadius: 8,
                  outline: "none",
                  fontSize: 12,
                }}
              />

              {message && (
                <p
                  style={{
                    fontSize: 10,
                    color: message.includes("successfully")
                      ? "#248a52"
                      : "#c0392b",
                    margin: "10px 0 0",
                  }}
                >
                  {message}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 15,
                }}
              >
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setOpen(false)}
                  style={{ fontSize: 11 }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button primary"
                  onClick={saveProfile}
                  disabled={saving}
                  style={{ fontSize: 11 }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}