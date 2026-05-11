// Radix-2 Cooley-Tukey FFT operating on separate real/imag Float64 buffers.
// In-place; size must be a power of two.

export class FFT {
	readonly size: number;
	private readonly cos: Float64Array;
	private readonly sin: Float64Array;
	private readonly rev: Uint32Array;

	constructor(size: number) {
		if (size < 2 || (size & (size - 1)) !== 0) {
			throw new Error(`FFT size must be a power of two, got ${size}`);
		}
		this.size = size;
		this.cos = new Float64Array(size / 2);
		this.sin = new Float64Array(size / 2);
		for (let i = 0; i < size / 2; i++) {
			const a = (-2 * Math.PI * i) / size;
			this.cos[i] = Math.cos(a);
			this.sin[i] = Math.sin(a);
		}
		this.rev = new Uint32Array(size);
		const bits = Math.log2(size) | 0;
		for (let i = 0; i < size; i++) {
			let x = i;
			let r = 0;
			for (let b = 0; b < bits; b++) {
				r = (r << 1) | (x & 1);
				x >>= 1;
			}
			this.rev[i] = r;
		}
	}

	forward(re: Float64Array, im: Float64Array): void {
		this.transform(re, im, false);
	}

	inverse(re: Float64Array, im: Float64Array): void {
		this.transform(re, im, true);
		const n = this.size;
		for (let i = 0; i < n; i++) {
			re[i] /= n;
			im[i] /= n;
		}
	}

	private transform(re: Float64Array, im: Float64Array, inverse: boolean): void {
		const n = this.size;
		const rev = this.rev;
		for (let i = 0; i < n; i++) {
			const j = rev[i];
			if (j > i) {
				let t = re[i];
				re[i] = re[j];
				re[j] = t;
				t = im[i];
				im[i] = im[j];
				im[j] = t;
			}
		}
		const cos = this.cos;
		const sin = this.sin;
		const sign = inverse ? -1 : 1;
		for (let len = 2; len <= n; len <<= 1) {
			const half = len >> 1;
			const step = n / len;
			for (let i = 0; i < n; i += len) {
				let k = 0;
				for (let j = i; j < i + half; j++) {
					const c = cos[k];
					const s = sign * sin[k];
					const tre = re[j + half] * c - im[j + half] * s;
					const tim = re[j + half] * s + im[j + half] * c;
					re[j + half] = re[j] - tre;
					im[j + half] = im[j] - tim;
					re[j] += tre;
					im[j] += tim;
					k += step;
				}
			}
		}
	}
}
