import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // รูปสินค้าจาก Shopee CDN
    remotePatterns: [
      { protocol: "https", hostname: "**.shopee.co.th" },
      { protocol: "https", hostname: "cf.shopee.co.th" },
      { protocol: "https", hostname: "down-th.img.susercontent.com" },
      { protocol: "https", hostname: "**.susercontent.com" },
    ],
  },
};

export default nextConfig;
