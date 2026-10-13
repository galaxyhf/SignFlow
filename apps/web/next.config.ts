import type { NextConfig } from 'next';
const config: NextConfig = { distDir:process.env.E2E==='true'?'.next-e2e':'.next', logging:{incomingRequests:false}, transpilePackages: ['@signflow/shared'], async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:3001'}/:path*` }]; }, async headers(){return [{source:'/:path*',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Cache-Control',value:'no-store'}]}];} };
export default config;
