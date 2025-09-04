/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Обязательно для next export
  reactStrictMode: true,
  basePath: '/NDFL', // !!! Укажите имя вашего РЕПОЗИТОРИЯ
  assetPrefix: '/NDFL/', // !!! Укажите имя вашего РЕПОЗИТОРИЯ
  images: {
    unoptimized: true, // Рекомендуется для статического экспорта, если вы используете next/image
  },
  // Отключение ESLint для продакшн сборки (если у вас есть проблемы с ESLint и вы не можете их быстро решить)
  // В противном случае, лучше решить проблемы ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Отключение TypeScript для продакшн сборки (если у вас есть проблемы с TS и вы не можете их быстро решить)
  // В противном случае, лучше решить проблемы TS
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;