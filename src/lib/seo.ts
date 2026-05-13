export const SITE_URL = 'https://musicdagger.xyz';
export const SITE_NAME = 'Music † Dagger';

export const DEFAULT_TITLE = 'Music † Dagger — psychoacoustic noise that breaks AI training';
export const DEFAULT_DESCRIPTION =
	"Bury imperceptible psychoacoustic noise inside your tracks so generative models can't cleanly learn from them. 100% in-browser, nothing uploaded.";

export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function canonical(pathname: string): string {
	const path = pathname || '/';
	const normalized = path.startsWith('/') ? path : `/${path}`;
	const trimmed =
		normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
	return `${SITE_URL}${trimmed}`;
}

export function absoluteUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const organizationJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'Organization',
	name: SITE_NAME,
	url: SITE_URL,
	logo: `${SITE_URL}${OG_IMAGE_PATH}`
};

export const websiteJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	name: SITE_NAME,
	url: SITE_URL
};

export const softwareApplicationJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: SITE_NAME,
	applicationCategory: 'MultimediaApplication',
	operatingSystem: 'Web',
	description:
		'Browser-based tool that injects imperceptible psychoacoustic noise into audio tracks to disrupt AI training datasets.',
	url: SITE_URL,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
};
