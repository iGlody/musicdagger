<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
</script>

<SeoHead path="/demo" title="Demo — Music † Dagger" description="Internal demo index." noindex />

<a href={resolve('/demo/playwright')}>playwright</a>
