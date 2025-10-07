// This is a configuration file for Capacitor.
// It defines the native app settings and deep linking schemes required for OAuth.

const config = {
  appId: 'com.currentsolutions.ai',
  appName: 'Current Solutions AI',
  webDir: '.', // The root directory of the web app.
  server: {
    androidScheme: 'https',
    iosScheme: 'currentai', // The custom scheme for iOS deep linking.
    cleartext: true,
  },
};

export default config;
