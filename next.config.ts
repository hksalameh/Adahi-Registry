
import type { NextConfig } from 'next';

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
        hostname: 'www.islamicc.org', // تمت إضافة نطاق الشعار الجديد
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      // النطاق الذي ظهر في تحذير npm run dev
      "https://3000-firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      // النطاق الذي يستخدمه Prototyper والذي أظهر خطأ 502
      "https://6000-firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      // نطاق عام لـ Firebase Studio للمشروع (احتياطي)
      "https://firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
      // قد تحتاج أيضًا إلى السماح للوصول من localhost إذا كنت تختبر محليًا خارج IDX
      // "http://localhost:3000" // إذا كنت تستخدم منفذًا آخر محليًا، قم بتغييره
    ],
  },
};

export default nextConfig;

