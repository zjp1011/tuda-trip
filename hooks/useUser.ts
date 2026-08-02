"use client";

import { useEffect, useMemo, useState } from "react";

const GUEST_ID_STORAGE_KEY = "tour_ai_guest_id";

export function useUser() {
  const [guestId, setGuestId] = useState("");

  useEffect(() => {
    const existingGuestId = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);

    if (existingGuestId) {
      setGuestId(existingGuestId);
      return;
    }

    const nextGuestId = crypto.randomUUID();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, nextGuestId);
    setGuestId(nextGuestId);
  }, []);

  const guestLabel = useMemo(() => {
    if (!guestId) {
      return "游客_加载中";
    }

    return `游客_${guestId.slice(0, 4)}`;
  }, [guestId]);

  return {
    guestId,
    guestLabel,
    isGuest: true,
  };
}
