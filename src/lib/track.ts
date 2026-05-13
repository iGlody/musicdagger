import { track } from '@vercel/analytics/sveltekit';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function trackEvent(name: string, props?: AnalyticsProps): void {
	try {
		track(name, props);
	} catch {
		// analytics may be blocked or not yet injected — never let it break the app
	}
}

export function truncate(s: string, max = 200): string {
	return s.length <= max ? s : s.slice(0, max);
}
