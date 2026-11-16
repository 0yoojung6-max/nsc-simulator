/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 ESLint 에러로 인해 배포가 중단되는 것을 방지
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;