
import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true, // تأكد من أن هذا true لتسجيل الـ Service Worker
  skipWaiting: true,
  //  هام: تم إعادته إلى الإعداد القياسي.
  //  سيتم تعطيل PWA في وضع التطوير، وتفعيله في وضع الإنتاج.
  disable: process.env.NODE_ENV === 'development', 
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.islamicc.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      "https://3000-firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      "https://6000-firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      "https://9003-firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      "https://firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
    ],
  },
};

export default withPWA(nextConfig);
    