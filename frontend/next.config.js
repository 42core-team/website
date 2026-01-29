/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    viewTransition: true,
  },
  output: "standalone",
  logging: {
    level: "info",
    format: "json",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.intra.42.fr",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
