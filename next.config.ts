/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Обязательно для next export
  reactStrictMode: true,
  basePath: '/NDFL', // Здесь укажите имя вашего репозитория на GitHub
  assetPrefix: '/NDFL/', // Также полезно для корректной загрузки ассетов
  images: {
    unoptimized: true, // Рекомендуется для статического экспорта, если вы используете next/image
  }
};

module.exports = nextConfig;