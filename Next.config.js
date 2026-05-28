/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['openai', 'node-telegram-bot-api']
  }
}

module.exports = nextConfig
