import type { NextConfig } from "next";

const repoName = 'voice-chat-demo';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: `/${repoName}`,
  assetPrefix: `/${repoName}/`,
  // If you use images or fonts, you may also want to set images.unoptimized = true
  // images: { unoptimized: true },
};

export default nextConfig;
