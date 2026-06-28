/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cloudinary', 'xlsx', 'bcryptjs', 'nodemailer'],
  },
}
module.exports = nextConfig
