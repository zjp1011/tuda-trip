export function buildShareUrl(shareId: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_SHARE_BASE_URL?.trim().replace(/\/$/, "");
  const browserBaseUrl =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

  return `${configuredBaseUrl || browserBaseUrl}/share/${shareId}`;
}

export function isLocalShareUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}
