/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/EFS-1_1.3',
  assetPrefix: '/EFS-1_1.3/',
  images: { unoptimized: true },
}

module.exports = nextConfig;
