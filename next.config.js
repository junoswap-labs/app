/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Config-level redirect: keeps `/` from compiling the whole client provider tree in dev.
    async redirects() {
        return [{ source: '/', destination: '/app/redeem', permanent: false }]
    },
    webpack: (config) => {
        config.resolve.fallback = { fs: false, net: false, tls: false }
        config.externals.push('pino-pretty', 'lokijs', 'encoding')
        return config
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
}

export default nextConfig
