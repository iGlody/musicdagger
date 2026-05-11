import type { ProtectOptions } from './protect';

export interface DecodedAudio {
	channels: Float32Array[];
	sampleRate: number;
}

export async function decodeWavFile(file: File): Promise<DecodedAudio> {
	const buf = await file.arrayBuffer();
	const AC: typeof AudioContext =
		(window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
			.AudioContext ??
		(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const ctx = new AC();
	try {
		const decoded = await ctx.decodeAudioData(buf);
		const channels: Float32Array[] = [];
		for (let c = 0; c < decoded.numberOfChannels; c++) {
			channels.push(new Float32Array(decoded.getChannelData(c)));
		}
		return { channels, sampleRate: decoded.sampleRate };
	} finally {
		ctx.close();
	}
}

export function protectInWorker(
	channels: Float32Array[],
	sampleRate: number,
	opts: Omit<ProtectOptions, 'onProgress'>,
	onProgress?: (frac: number) => void,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./protect.worker.ts', import.meta.url), {
			type: 'module',
		});
		worker.onerror = (e) => {
			worker.terminate();
			reject(new Error(e.message || 'Worker error'));
		};
		worker.onmessage = (e: MessageEvent) => {
			const msg = e.data;
			if (msg.type === 'progress') {
				onProgress?.(msg.frac);
			} else if (msg.type === 'done') {
				worker.terminate();
				resolve({ channels: msg.channels, sampleRate: msg.sampleRate });
			}
		};
		const transfer = channels.map((c) => c.buffer);
		worker.postMessage({ type: 'protect', channels, sampleRate, opts }, transfer);
	});
}
