import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.tvoff',
  appName: 'TV-Off',
  webDir: 'dist',
  server: {
    url: 'https://12ff4602-0645-4699-b206-3fab7b07d5e2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
