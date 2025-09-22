export function applyNode18Polyfills(): void {
	const g = globalThis as unknown as { [key: string]: unknown };
	if (typeof (g as any).File === "undefined") {
		(g as any).File = class {};
	}
}

// Apply immediately on import
applyNode18Polyfills();
