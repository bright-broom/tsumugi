import type { APIRoute } from 'astro';
import { DOMAIN } from '../data/config';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nSitemap: https://${DOMAIN}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } });
