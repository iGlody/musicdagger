// Quick smoke test runnable via `node --import tsx src/lib/audio/protect.smoke.ts`
import { generateProtectedChannel } from './protect';

function maxAbs(a: Float32Array): number {
	let m = 0;
	for (let i = 0; i < a.length; i++) {
		const v = Math.abs(a[i]);
		if (v > m) m = v;
	}
	return m;
}

function rms(a: Float32Array): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * a[i];
	return Math.sqrt(s / a.length);
}

const sr = 44100;

// Test 1: silence in → silence out
{
	const N = 8192;
	const silent = new Float32Array(N);
	const out = generateProtectedChannel(silent, sr);
	const m = maxAbs(out);
	console.log(`[silence] max |out| = ${m.toExponential(3)} (must be ~0)`);
	if (m > 1e-3) {
		throw new Error('FAIL: silence produced audible output');
	}
}

// Test 2: sine 1 kHz, amplitude 0.5 → near-identical output (subtle noise)
{
	const N = 16384;
	const sine = new Float32Array(N);
	for (let i = 0; i < N; i++) sine[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr);
	const out = generateProtectedChannel(sine, sr);

	const diff = new Float32Array(N);
	for (let i = 0; i < N; i++) diff[i] = out[i] - sine[i];
	// Ignore the first/last window worth of samples to skip edge artifacts.
	const inner = diff.subarray(1024, N - 1024);
	const innerRms = rms(inner);
	const sigRms = rms(sine.subarray(1024, N - 1024));
	const ratio = innerRms / sigRms;
	console.log(
		`[1k sine] signal RMS = ${sigRms.toFixed(4)}, diff RMS = ${innerRms.toFixed(4)}, ratio = ${ratio.toFixed(4)}`,
	);
	if (ratio > 0.05) {
		throw new Error('FAIL: noise too loud relative to signal');
	}
}

console.log('OK');
