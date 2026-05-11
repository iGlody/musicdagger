// Port of HarmonyDagger's generate_psychoacoustic_noise + generate_protected_audio.
// Operates on Float32 PCM channels normalized to [-1, 1].

import { FFT } from './fft';
import {
	barkScale,
	criticalBandWidth,
	hearingThresholdDb,
	magnitudeToDb,
	dbToMagnitude,
} from './psychoacoustics';

export const DEFAULT_WINDOW_SIZE = 1024;
export const DEFAULT_HOP_SIZE = 512;
export const DEFAULT_NOISE_SCALE = 0.01;
const MASKING_CURVE_SLOPE = 0.8;
const ADAPTIVE_SCALE_NORM_MIN = 0.5;
const ADAPTIVE_SCALE_NORM_RANGE = 1.0;
const ADAPTIVE_SIGNAL_STRENGTH_DIV = 60.0;
const NOISE_UPPER_BOUND_FACTOR = 0.8;
export const DEFAULT_DRY_WET = 1.0;

const VOCAL_LO = 300;
const VOCAL_HI = 3000;
const VOCAL_BASE = 2.0;
const VOCAL_FORMANTS = [500, 1500, 2500];
const VOCAL_FORMANT_SIGMA = 200;
const VOCAL_FORMANT_PEAK = 0.5;

export interface ProtectOptions {
	noiseScale?: number;
	dryWet?: number;
	adaptiveScaling?: boolean;
	vocalMode?: boolean;
	windowSize?: number;
	hopSize?: number;
	onProgress?: (frac: number) => void;
}

function hann(n: number): Float64Array {
	const w = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
	}
	return w;
}

function sum(arr: Float64Array): number {
	let s = 0;
	for (let i = 0; i < arr.length; i++) s += arr[i];
	return s;
}

function vocalCurve(freqHz: number): number {
	if (freqHz < VOCAL_LO || freqHz > VOCAL_HI) return 1.0;
	let boost = VOCAL_BASE;
	for (const f0 of VOCAL_FORMANTS) {
		const d = (freqHz - f0) / VOCAL_FORMANT_SIGMA;
		boost += VOCAL_FORMANT_PEAK * Math.exp(-0.5 * d * d);
	}
	return boost;
}

function precomputeFreqTables(windowSize: number, sr: number) {
	const half = windowSize / 2 + 1;
	const freqs = new Float64Array(half);
	const barkFreqs = new Float64Array(half);
	const hearingMag = new Float64Array(half);
	const hearingDb = new Float64Array(half);
	const vocal = new Float64Array(half);
	for (let i = 0; i < half; i++) {
		const f = (i * sr) / windowSize;
		freqs[i] = f;
		barkFreqs[i] = barkScale(f);
		const hd = hearingThresholdDb(f);
		hearingDb[i] = hd;
		hearingMag[i] = dbToMagnitude(hd);
		vocal[i] = vocalCurve(f);
	}
	return { freqs, barkFreqs, hearingMag, hearingDb, vocal };
}

export function generateProtectedChannel(
	audio: Float32Array,
	sr: number,
	opts: ProtectOptions = {},
): Float32Array {
	const windowSize = opts.windowSize ?? DEFAULT_WINDOW_SIZE;
	const hopSize = opts.hopSize ?? DEFAULT_HOP_SIZE;
	const noiseScale = opts.noiseScale ?? DEFAULT_NOISE_SCALE;
	const dryWet = opts.dryWet ?? DEFAULT_DRY_WET;
	const adaptive = opts.adaptiveScaling ?? true;
	const vocalMode = opts.vocalMode ?? false;
	const onProgress = opts.onProgress;

	const fft = new FFT(windowSize);
	const win = hann(windowSize);
	const winSum = sum(win); // matches scipy stft scaling='spectrum'

	const N = audio.length;
	const padded = windowSize + hopSize * Math.ceil(Math.max(0, N - windowSize) / hopSize);
	const numFrames = 1 + Math.floor((padded - windowSize) / hopSize);

	const tables = precomputeFreqTables(windowSize, sr);
	const halfBins = windowSize / 2 + 1;
	const binHz = sr / windowSize;

	const re = new Float64Array(windowSize);
	const im = new Float64Array(windowSize);
	const noiseRe = new Float64Array(windowSize);
	const noiseIm = new Float64Array(windowSize);

	const noiseOut = new Float64Array(padded);
	const windowSumSq = new Float64Array(padded);

	for (let f = 0; f < numFrames; f++) {
		const start = f * hopSize;
		for (let i = 0; i < windowSize; i++) {
			const idx = start + i;
			const s = idx < N ? audio[idx] : 0;
			re[i] = s * win[i];
			im[i] = 0;
		}
		fft.forward(re, im);

		// Dominant bin over positive frequencies
		let domIdx = 0;
		let domMagRaw = -1;
		for (let k = 0; k < halfBins; k++) {
			const m = Math.hypot(re[k], im[k]);
			if (m > domMagRaw) {
				domMagRaw = m;
				domIdx = k;
			}
		}
		const domHz = tables.freqs[domIdx];
		const domBark = tables.barkFreqs[domIdx];
		const cbWidthHz = criticalBandWidth(domHz);
		const bandBins = Math.max(1, Math.floor(cbWidthHz / binHz));

		for (let k = 0; k < windowSize; k++) {
			noiseRe[k] = 0;
			noiseIm[k] = 0;
		}

		for (let off = -bandBins; off <= bandBins; off++) {
			const k = domIdx + off;
			if (k < 0 || k >= halfBins) continue;

			const sigRe = re[k];
			const sigIm = im[k];
			const sigMagRaw = Math.hypot(sigRe, sigIm);
			// Convert to scipy 'spectrum' scale for psychoacoustic comparisons
			const sigMag = sigMagRaw / winSum;
			if (sigMag <= 0) continue;

			const sigDb = magnitudeToDb(sigMag);

			const freqDistBark = Math.abs(tables.barkFreqs[k] - domBark);
			const maskAttDb = MASKING_CURVE_SLOPE * freqDistBark;

			let scale = noiseScale;
			if (adaptive) {
				const above = sigDb - tables.hearingDb[k];
				if (above > 0) {
					const factor =
						ADAPTIVE_SCALE_NORM_MIN +
						Math.min(ADAPTIVE_SCALE_NORM_RANGE, above / ADAPTIVE_SIGNAL_STRENGTH_DIV);
					scale = noiseScale * factor;
				}
			}

			let noiseMag = scale * sigMag * (1.0 - maskAttDb / 20.0);
			const hi = NOISE_UPPER_BOUND_FACTOR * sigMag;
			const lo = tables.hearingMag[k];

			// np.clip semantics: when lo > hi, NumPy returns hi.
			if (lo > hi) {
				noiseMag = hi;
			} else if (noiseMag < lo) {
				noiseMag = lo;
			} else if (noiseMag > hi) {
				noiseMag = hi;
			}

			if (vocalMode) noiseMag *= tables.vocal[k];

			// Negative values from (1 - maskAttDb/20) with large attenuation get clipped above too.
			if (noiseMag <= 0) continue;

			// Apply ratio in raw-FFT scale (scale-invariant).
			const phaseScale = noiseMag / sigMag; // = noiseMagRaw / sigMagRaw
			noiseRe[k] = sigRe * phaseScale;
			noiseIm[k] = sigIm * phaseScale;

			// Hermitian conjugate for the mirror bin to keep ifft real
			if (k > 0 && k < windowSize / 2) {
				const mk = windowSize - k;
				noiseRe[mk] = noiseRe[k];
				noiseIm[mk] = -noiseIm[k];
			}
		}

		fft.inverse(noiseRe, noiseIm);

		// Overlap-add with synthesis window
		for (let i = 0; i < windowSize; i++) {
			const idx = start + i;
			noiseOut[idx] += noiseRe[i] * win[i];
			windowSumSq[idx] += win[i] * win[i];
		}

		if (onProgress && (f & 31) === 0) onProgress(f / numFrames);
	}

	const out = new Float32Array(N);
	for (let i = 0; i < N; i++) {
		const w = windowSumSq[i];
		const n = w > 1e-8 ? noiseOut[i] / w : 0;
		let v = audio[i] + dryWet * n;
		if (v > 1) v = 1;
		else if (v < -1) v = -1;
		out[i] = v;
	}

	if (onProgress) onProgress(1);
	return out;
}

export function generateProtectedMultichannel(
	channels: Float32Array[],
	sr: number,
	opts: ProtectOptions = {},
): Float32Array[] {
	const total = channels.length;
	return channels.map((ch, idx) =>
		generateProtectedChannel(ch, sr, {
			...opts,
			onProgress: opts.onProgress
				? (frac) => opts.onProgress!((idx + frac) / total)
				: undefined,
		}),
	);
}
