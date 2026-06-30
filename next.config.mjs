/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: no Next.js server needed. Deploys as plain files to
  // Cloudflare Pages, Render (Static Site), Netlify, GitHub Pages, etc.
  output: "export",
  trailingSlash: true,
  images: {
    // Static export can't use the Next image optimizer.
    unoptimized: true,
  },
};

export default nextConfig;
