import type { APIRoute } from 'astro';
import { DOMAIN } from '../data/config';
import { NAV } from '../data/nav';
import { IND_DATA } from '../data/industries';
import { NAV_LEGAL } from '../data/nav';

/** 404 は載せない。並びは Python 版（NAV → 法務 → 業種）に合わせる */
const FILES = [...NAV.map(([f]) => f), ...NAV_LEGAL.map(([f]) => f), ...Object.keys(IND_DATA)];

export const GET: APIRoute = () =>
  new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      FILES.map((f) => `  <url><loc>https://${DOMAIN}/${f}</loc></url>\n`).join('') +
      '</urlset>\n',
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
