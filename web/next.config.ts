import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.join(import.meta.dirname, '..'),
  },
};

export default nextConfig;
