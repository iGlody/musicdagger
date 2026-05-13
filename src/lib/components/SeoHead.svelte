<script lang="ts">
	import {
		DEFAULT_DESCRIPTION,
		DEFAULT_TITLE,
		OG_IMAGE_HEIGHT,
		OG_IMAGE_PATH,
		OG_IMAGE_WIDTH,
		SITE_NAME,
		absoluteUrl,
		canonical
	} from '$lib/seo';

	type Props = {
		path: string;
		title?: string;
		description?: string;
		image?: string;
		noindex?: boolean;
		jsonLd?: unknown[];
	};

	let {
		path,
		title = DEFAULT_TITLE,
		description = DEFAULT_DESCRIPTION,
		image = OG_IMAGE_PATH,
		noindex = false,
		jsonLd = []
	}: Props = $props();

	const canonicalUrl = $derived(canonical(path));
	const ogImageUrl = $derived(absoluteUrl(image));

	function serializeJsonLd(block: unknown): string {
		return JSON.stringify(block).replace(/</g, '\\u003c');
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="theme-color" content="#0a0a0a" />
	{#if noindex}
		<meta name="robots" content="noindex,follow" />
	{/if}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
	<meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImageUrl} />

	{#each jsonLd as block, i (i)}
		{@html `<script type="application/ld+json">${serializeJsonLd(block)}<\/script>`}
	{/each}
</svelte:head>
