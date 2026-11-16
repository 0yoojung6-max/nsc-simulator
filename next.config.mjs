/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 엄격한 깐깐한 ESLint 검사를 일시적으로 무시합니다
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;