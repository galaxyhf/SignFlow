import 'dotenv/config';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
config({path:'../../.env',quiet:true});
export default defineConfig({schema:'./src/database/schema.ts',out:'./drizzle',dialect:'postgresql',dbCredentials:{url:process.env.DATABASE_URL_UNPOOLED||''},strict:true});
