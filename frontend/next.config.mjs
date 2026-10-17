/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
  },
  experimental: {
    // optimize package imports for lucide icons and charts
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
