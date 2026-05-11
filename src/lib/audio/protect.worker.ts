import { generateProtectedMultichannel, type ProtectOptions } from './protect';

interface RequestMsg {
	type: 'protect';
	channels: Float32Array[];
	sampleRate: number;
	opts: Omit<ProtectOptions, 'onProgress'>;
}

self.onmessage = (e: MessageEvent<RequestMsg>) => {
	const { channels, sampleRate, opts } = e.data;
	const out = generateProtectedMultichannel(channels, sampleRate, {
		...opts,
		onProgress: (frac) => {
			(self as unknown as Worker).postMessage({ type: 'progress', frac });
		},
	});
	const transfer = out.map((c) => c.buffer);
	(self as unknown as Worker).postMessage(
		{ type: 'done', channels: out, sampleRate },
		{ transfer },
	);
};
