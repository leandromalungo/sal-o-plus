/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/**': ['./firebase-applet-config.json'],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
