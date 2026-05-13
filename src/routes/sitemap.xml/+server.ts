import { SITE_URL } from '$lib/seo';

export const prerender = true;

const urls: { loc: string; changefreq: string; priority: string }[] = [
	{ loc: '/', changefreq: 'weekly', priority: '1.0' }
];

export function GET() {
	const lastmod = new Date().toISOString().slice(0, 10);
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(u) => `\t<url>
\t\t<loc>${SITE_URL}${u.loc === '/' ? '' : u.loc}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t\t<changefreq>${u.changefreq}</changefreq>
\t\t<priority>${u.priority}</priority>
\t</url>`
	)
	.join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
