import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.effectnote.mobile',
  appName: 'EffectNote',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
