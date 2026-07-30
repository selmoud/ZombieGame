"use client";

import { useEffect } from "react";

export function LoginSessionRecovery({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    url.searchParams.set("recover", "checked");
    window.location.replace(url);
  }, [enabled]);

  return null;
}
