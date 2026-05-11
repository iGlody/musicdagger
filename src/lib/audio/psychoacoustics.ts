// Psychoacoustic helpers ported from HarmonyDagger
// (Zwicker / Traunmüller / Painter-Spanias standard formulas).

const REFERENCE_PRESSURE = 2e-5;
const DB_LOG_EPSILON = 1e-12;
const HZ_TO_KHZ = 1000;

const BARK_C1 = 13;
const BARK_C2 = 0.00076;
const BARK_C3 = 3.5;
const BARK_F_DIV = 7500;

const CBW_C1 = 25;
const CBW_C2 = 75;
const CBW_C3 = 1.4;
const CBW_F_POW = 0.69;

const HEAR_C1 = 3.64;
const HEAR_F_POW = -0.8;
const HEAR_C2 = -6.5;
const HEAR_EXP_C1 = -0.6;
const HEAR_F_OFFSET = 3.3;

export function barkScale(freqHz: number): number {
	return (
		BARK_C1 * Math.atan(BARK_C2 * freqHz) +
		BARK_C3 * Math.atan(Math.pow(freqHz / BARK_F_DIV, 2))
	);
}

export function criticalBandWidth(centerHz: number): number {
	const fk = centerHz / HZ_TO_KHZ;
	return CBW_C1 + CBW_C2 * Math.pow(1 + CBW_C3 * fk * fk, CBW_F_POW);
}

export function hearingThresholdDb(freqHz: number): number {
	const fk = Math.max(freqHz / HZ_TO_KHZ, 1e-6);
	const diff = fk - HEAR_F_OFFSET;
	return HEAR_C1 * Math.pow(fk, HEAR_F_POW) - HEAR_C2 * Math.exp(HEAR_EXP_C1 * diff * diff);
}

export function magnitudeToDb(mag: number): number {
	const m = Math.max(mag, DB_LOG_EPSILON);
	return 20 * Math.log10(m / REFERENCE_PRESSURE);
}

export function dbToMagnitude(db: number): number {
	const clipped = Math.min(db, 350);
	return Math.pow(10, clipped / 20) * REFERENCE_PRESSURE;
}
