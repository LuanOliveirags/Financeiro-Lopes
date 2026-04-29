// Detecta ambiente Capacitor (APK) vs browser web
export const isNative = () =>
  !!(window.Capacitor && window.Capacitor.isNativePlatform?.());

// Acessa plugins nativos registrados pelo Capacitor
export const getPlugin = (name) =>
  window.Capacitor?.Plugins?.[name] ?? null;
