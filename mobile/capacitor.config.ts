import type { CapacitorConfig } from "@capacitor/cli";

// Agora iOS/Android shell. The web layer is a static SPA build of the app in
// ../ (`npm run build:web` → ../dist/client) that calls the production server
// functions at https://ago-ra.life (see ../src/lib/site.ts).
//
// appId is permanent once the app is uploaded to App Store Connect / Play
// Console — change it before the first upload if you want a different one.
const BACKGROUND = "#fdf6ea"; // --background in ../src/styles.css

const config: CapacitorConfig = {
  appId: "life.agora.app",
  appName: "Agora",
  webDir: "../dist/client",
  backgroundColor: BACKGROUND,
  ios: {
    // Keep web content inside the safe area (status bar, home indicator)
    // without changing the web CSS.
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: BACKGROUND,
      showSpinner: false,
    },
    SystemBars: {
      // Android: keep the WebView out from under the system bars (the web app
      // doesn't use viewport-fit=cover), dark icons on the light background.
      insetsHandling: "css",
      style: "LIGHT",
    },
  },
};

export default config;
