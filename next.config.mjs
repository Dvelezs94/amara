/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      { source: "/work-orders", destination: "/tareas", permanent: true },
      { source: "/work-orders/:path*", destination: "/tareas/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
