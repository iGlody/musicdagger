// 16-bit PCM WAV encoder. Accepts one Float32Array per channel, [-1, 1].

export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
	const numChannels = channels.length;
	const numFrames = channels[0].length;
	const bytesPerSample = 2;
	const blockAlign = numChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = numFrames * blockAlign;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	const writeStr = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
	};

	writeStr(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeStr(8, 'WAVE');
	writeStr(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true);
	writeStr(36, 'data');
	view.setUint32(40, dataSize, true);

	let offset = 44;
	for (let i = 0; i < numFrames; i++) {
		for (let c = 0; c < numChannels; c++) {
			let s = channels[c][i];
			if (s > 1) s = 1;
			else if (s < -1) s = -1;
			view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
			offset += 2;
		}
	}
	return buffer;
}
