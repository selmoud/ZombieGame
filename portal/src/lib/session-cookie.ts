export function shouldUseSecureCookies() {
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    return appUrl.startsWith("https://");
  }
  return process.env.NODE_ENV === "production";
}
