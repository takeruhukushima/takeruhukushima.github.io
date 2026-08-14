import type { APIRoute } from 'astro';
import { getCvExport } from '../lib/cv';

export const prerender = true;

export const GET: APIRoute = async () => {
  const cv = await getCvExport();

  return new Response(`${JSON.stringify(cv, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
};
