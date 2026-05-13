import { SITE_URL } from '$lib/seo';

export const prerender = true;

export function GET() {
	const body = `# musicdagger.xyz
User-agent: *
Allow: /
Disallow: /demo

Sitemap: ${SITE_URL}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
