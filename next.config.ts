
import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  //  هام: تم تغيير 'disable' إلى 'false' مؤقتًا لاختبار PWA في وضع التطوير.
  //  يجب إعادته إلى 'process.env.NODE_ENV === 'development'' قبل النشر النهائي.
  disable: false, 
  // يمكنك إضافة المزيد من إعدادات PWA هنا إذا لزم الأمر
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
      "https://firebase-studio-1747137389331.cluster-jbb3mjctu5cbgsi6hwq6u4btwe.cloudworkstations.dev",
    ],
  },
};

export default withPWA(nextConfig);
