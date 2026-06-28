/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cloudinary', 'xlsx', 'bcryptjs'],
  },
}
module.exports = nextConfig
