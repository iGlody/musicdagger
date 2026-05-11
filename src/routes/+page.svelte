<script lang="ts">
	import { decodeWavFile, protectInWorker } from '$lib/audio/processor';
	import { encodeWav } from '$lib/audio/wav';
	import { track } from '@vercel/analytics/sveltekit';

	type EventProps = Record<string, string | number | boolean | null>;
	const trackEvent = (name: string, props?: EventProps) => track(name, props);

	type Stage = 'idle' | 'decoding' | 'processing' | 'ready' | 'error';

	let file = $state<File | null>(null);
	let stage = $state<Stage>('idle');
	let progress = $state(0);
	let errorMsg = $state('');
	let noiseScale = $state(0.01);
	let dryWet = $state(1.0);
	let vocalMode = $state(false);
	let adaptive = $state(true);

	let originalUrl = $state<string | null>(null);
	let protectedUrl = $state<string | null>(null);
	let protectedBlob = $state<Blob | null>(null);
	let durationSec = $state(0);
	let channelCount = $state(0);
	let sampleRate = $state(0);
	let elapsedMs = $state(0);

	let dragging = $state(false);

	function resetOutputs() {
		if (originalUrl) URL.revokeObjectURL(originalUrl);
		if (protectedUrl) URL.revokeObjectURL(protectedUrl);
		originalUrl = null;
		protectedUrl = null;
		protectedBlob = null;
	}

	function chooseFile(f: File) {
		resetOutputs();
		file = f;
		stage = 'idle';
		progress = 0;
		errorMsg = '';
		originalUrl = URL.createObjectURL(f);
		const dot = f.name.lastIndexOf('.');
		const ext = dot >= 0 ? f.name.slice(dot + 1).toLowerCase() : 'unknown';
		trackEvent('file_selected', {
			size_mb: Math.round((f.size / (1024 * 1024)) * 100) / 100,
			ext,
		});
	}

	function onFileInput(e: Event) {
		const t = e.target as HTMLInputElement;
		const f = t.files?.[0];
		if (f) chooseFile(f);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) chooseFile(f);
	}

	async function runProtect() {
		if (!file) return;
		stage = 'decoding';
		progress = 0;
		errorMsg = '';
		trackEvent('protect_started', {
			noise_scale: noiseScale,
			dry_wet: dryWet,
			adaptive,
			vocal_mode: vocalMode,
		});
		const t0 = performance.now();
		try {
			const decoded = await decodeWavFile(file);
			channelCount = decoded.channels.length;
			sampleRate = decoded.sampleRate;
			durationSec = decoded.channels[0].length / decoded.sampleRate;

			stage = 'processing';
			const result = await protectInWorker(
				decoded.channels,
				decoded.sampleRate,
				{ noiseScale, dryWet, adaptiveScaling: adaptive, vocalMode },
				(frac) => {
					progress = frac;
				},
			);

			const wavBuf = encodeWav(result.channels, result.sampleRate);
			const blob = new Blob([wavBuf], { type: 'audio/wav' });
			protectedBlob = blob;
			protectedUrl = URL.createObjectURL(blob);
			elapsedMs = performance.now() - t0;
			stage = 'ready';
			trackEvent('protect_completed', {
				channels: channelCount,
				sample_rate: sampleRate,
				duration_sec: Math.round(durationSec),
				elapsed_ms: Math.round(elapsedMs),
				noise_scale: noiseScale,
				vocal_mode: vocalMode,
			});
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
			trackEvent('protect_failed', {
				error_kind: stage === 'processing' ? 'process' : 'decode',
			});
			stage = 'error';
		}
	}

	function download() {
		if (!protectedBlob || !file || !protectedUrl) return;
		trackEvent('download_clicked', {
			duration_sec: Math.round(durationSec),
			channels: channelCount,
		});
		const a = document.createElement('a');
		a.href = protectedUrl;
		const base = file.name.replace(/\.[^.]+$/, '');
		a.download = `${base}.protected.wav`;
		a.click();
	}

	const busy = $derived(stage === 'decoding' || stage === 'processing');
	const pct = $derived(Math.round(progress * 100));
</script>

<svelte:head>
	<title>music † dagger</title>
	<meta
		name="description"
		content="Imperceptible psychoacoustic noise for musicians who refuse to feed the machines."
	/>
</svelte:head>

<main
	class="relative z-10 mx-auto flex max-w-3xl flex-col gap-14 px-8 pt-14 pb-24 md:px-14 md:pt-20 md:pb-32"
>
	<header
		class="animate-rise flex flex-wrap items-baseline justify-between gap-4 [animation-delay:0.05s]"
	>
		<div class="flex items-baseline gap-3 text-5xl leading-none md:text-6xl">
			<span>Music</span>
			<svg
				viewBox="0 0 16 16"
				xmlns="http://www.w3.org/2000/svg"
				shape-rendering="crispEdges"
				fill="currentColor"
				aria-hidden="true"
				class="h-[0.9em] w-[0.9em] translate-y-[0.08em] self-center text-ink"
			>
				<rect x="15" y="0" width="1" height="1" />
				<rect x="14" y="1" width="2" height="1" />
				<rect x="13" y="2" width="2" height="1" />
				<rect x="12" y="3" width="2" height="1" />
				<rect x="11" y="4" width="2" height="1" />
				<rect x="10" y="5" width="2" height="1" />
				<rect x="9" y="6" width="2" height="1" />
				<rect x="8" y="7" width="2" height="1" />
				<rect x="7" y="8" width="2" height="1" />
				<rect x="5" y="9" width="5" height="1" />
				<rect x="5" y="10" width="5" height="1" />
				<rect x="5" y="11" width="2" height="1" />
				<rect x="4" y="12" width="2" height="1" />
				<rect x="3" y="13" width="2" height="1" />
				<rect x="2" y="14" width="2" height="1" />
				<rect x="1" y="15" width="2" height="1" />
			</svg>
			<span>Dagger</span>
		</div>
		<div class="flex items-center gap-2.5 text-[0.7rem] tracking-[0.25em] uppercase">
			<span class="animate-blink inline-block h-1.5 w-1.5 bg-ink"></span>
			<span>v0.1 · blackflag</span>
		</div>
	</header>

	<section class="animate-rise max-w-xl [animation-delay:0.15s]">
		<p class="mb-3 text-[0.72rem] tracking-[0.22em] uppercase">
			— adversarial noise for those who refuse to feed the machines.
		</p>
		<p class="text-base leading-relaxed">
			Upload a track. We bury imperceptible psychoacoustic noise inside it — calibrated to
			your music, hidden under the masking threshold of human hearing, loud enough to poison
			a generative model's training signal. Nothing leaves this browser.
		</p>
	</section>

	<section
		class="animate-rise relative border border-line bg-[#0f0f0e]/55 backdrop-blur-sm [animation-delay:0.25s] {dragging
			? '!border-ink !bg-ink/5'
			: ''} {file && !dragging ? '!border-ink/60' : ''}"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
		aria-label="Upload audio file"
	>
		<span class="pointer-events-none absolute -top-px -left-px h-3.5 w-3.5 border-t border-l border-ink"></span>
		<span class="pointer-events-none absolute -top-px -right-px h-3.5 w-3.5 border-t border-r border-ink"></span>
		<span class="pointer-events-none absolute -bottom-px -left-px h-3.5 w-3.5 border-b border-l border-ink"></span>
		<span class="pointer-events-none absolute -right-px -bottom-px h-3.5 w-3.5 border-r border-b border-ink"></span>

		<label class="relative flex cursor-pointer flex-col items-center justify-center gap-3.5 px-6 py-16 text-center">
			<input
				type="file"
				accept=".wav,audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/flac,audio/ogg"
				class="pointer-events-none absolute h-0 w-0 opacity-0"
				onchange={onFileInput}
			/>
			<span aria-hidden="true" class="text-4xl leading-none">+</span>
			<span class="text-lg tracking-wide">
				{file ? file.name : 'drag a track  /  click to choose'}
			</span>
			<span class="text-[0.7rem] tracking-[0.22em] uppercase">
				{file
					? `${(file.size / (1024 * 1024)).toFixed(2)} mb`
					: '.wav preferred · any browser-decodable audio accepted'}
			</span>
		</label>
	</section>

	<section class="animate-rise flex flex-col gap-9 [animation-delay:0.35s]">
		<div>
			<div class="mb-2.5 flex items-baseline justify-between">
				<span class="text-[0.7rem] tracking-[0.28em] uppercase">Strength</span>
				<span class="text-base tabular-nums">{noiseScale.toFixed(3)}</span>
			</div>
			<input
				type="range"
				min="0.001"
				max="0.1"
				step="0.001"
				bind:value={noiseScale}
				aria-label="Protection strength"
			/>
			<p class="mt-2 text-[0.7rem] tracking-wide">
				higher = harder to scrape, more risk of artefacts · ref. 0.010
			</p>
		</div>

		<div>
			<div class="mb-2.5 flex items-baseline justify-between">
				<span class="text-[0.7rem] tracking-[0.28em] uppercase">Dry / Wet</span>
				<span class="text-base tabular-nums">{dryWet.toFixed(2)}</span>
			</div>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={dryWet}
				aria-label="Dry / wet mix"
			/>
			<p class="mt-2 text-[0.7rem] tracking-wide">0 = original, 1 = full protection layer</p>
		</div>

		<div class="flex flex-wrap gap-7">
			<label class="inline-flex cursor-pointer items-center gap-3 text-[0.78rem] tracking-[0.22em] uppercase">
				<input type="checkbox" bind:checked={adaptive} class="peer sr-only" />
				<span
					aria-hidden="true"
					class="inline-block h-3 w-3 border border-ink transition-colors peer-checked:bg-ink"
				></span>
				<span>Adaptive scaling</span>
			</label>
			<label class="inline-flex cursor-pointer items-center gap-3 text-[0.78rem] tracking-[0.22em] uppercase">
				<input type="checkbox" bind:checked={vocalMode} class="peer sr-only" />
				<span
					aria-hidden="true"
					class="inline-block h-3 w-3 border border-ink transition-colors peer-checked:bg-ink"
				></span>
				<span>Vocal emphasis</span>
			</label>
		</div>
	</section>

	<section class="animate-rise flex flex-wrap items-center gap-7 [animation-delay:0.45s]">
		<button
			type="button"
			onclick={runProtect}
			disabled={!file || busy}
			aria-label="Protect this file"
			class="group inline-flex cursor-pointer items-center gap-3.5 border border-ink bg-ink px-7 py-4 text-[0.85rem] tracking-[0.32em] text-bg uppercase transition-colors hover:bg-bg hover:text-ink active:translate-x-px active:translate-y-px disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink"
		>
			<span aria-hidden="true" class="text-xs">▶</span>
			<span>{busy ? 'working' : 'protect'}</span>
		</button>

		{#if busy}
			<div class="min-w-[220px] flex-1" aria-live="polite">
				<div class="relative h-0.5 overflow-hidden bg-line">
					<div
						class="absolute inset-y-0 left-0 bg-ink transition-[width] duration-150"
						style="width: {pct}%"
					></div>
				</div>
				<div class="mt-2.5 flex justify-between text-[0.7rem] tracking-[0.22em] uppercase">
					<span>{stage === 'decoding' ? 'decoding' : 'processing'}</span>
					<span class="tabular-nums">{String(pct).padStart(3, '0')}%</span>
				</div>
			</div>
		{/if}
	</section>

	{#if errorMsg}
		<p class="border-l-2 border-danger bg-danger/5 px-3.5 py-2 text-[0.85rem] text-danger">
			! {errorMsg}
		</p>
	{/if}

	{#if originalUrl}
		<section class="animate-rise flex flex-col gap-9 md:flex-row md:gap-8">
			<div class="flex-1">
				<div class="mb-3.5 flex items-center gap-3">
					<span class="inline-block h-px w-6 bg-ink"></span>
					<span class="text-[0.72rem] tracking-[0.32em] uppercase">original</span>
				</div>
				<audio controls src={originalUrl}></audio>
			</div>
			<div class="flex-1">
				<div class="mb-3.5 flex items-center gap-3">
					<span class="inline-block h-px w-6 bg-ink"></span>
					<span class="text-[0.72rem] tracking-[0.32em] uppercase">protected</span>
				</div>
				{#if protectedUrl}
					<audio controls src={protectedUrl}></audio>
				{:else}
					<p class="text-[0.78rem] tracking-wide">awaiting render —</p>
				{/if}
			</div>
		</section>
	{/if}

	{#if stage === 'ready'}
		<section
			class="animate-rise flex flex-wrap items-center justify-between gap-5 border-y border-line py-5"
		>
			<div class="flex flex-wrap gap-2.5 text-[0.72rem] tracking-[0.2em] uppercase">
				<span>{channelCount}ch</span>
				<span>/</span>
				<span>{sampleRate}hz</span>
				<span>/</span>
				<span>{durationSec.toFixed(1)}s</span>
				<span>/</span>
				<span>rendered in {(elapsedMs / 1000).toFixed(1)}s</span>
			</div>
			<button
				type="button"
				onclick={download}
				class="inline-flex cursor-pointer items-center gap-3 border border-ink bg-transparent px-5 py-3 text-[0.8rem] tracking-[0.28em] text-ink uppercase transition-colors hover:bg-ink hover:text-bg"
			>
				<span aria-hidden="true">↓</span>
				<span>download .wav</span>
			</button>
		</section>
	{/if}

	<footer class="mt-3">
		<div class="mb-[18px] h-px bg-line"></div>
		<div class="flex flex-wrap justify-between gap-3 text-[0.68rem] tracking-[0.22em] uppercase">
			<span>psychoacoustic masking · 100% local · nothing uploaded</span>
			<span>
				algorithm after
				<a
					href="https://github.com/jaschadub/harmonydagger"
					target="_blank"
					rel="noreferrer"
					class="border-b border-line transition-colors hover:border-ink"
				>
					harmonydagger
				</a>
			</span>
		</div>
	</footer>
</main>
