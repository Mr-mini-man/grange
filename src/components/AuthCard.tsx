import type { ReactNode } from "react";

export const inputClass =
	"rounded border border-leaf/40 bg-barn-deep px-3 py-2 text-cream outline-none transition focus:border-leaf focus:ember-border text-leaf";
export const labelClass = "flex flex-col gap-1 text-sm text-cream";
export const buttonClass =
	"rounded border border-barn-red/60 bg-barn-red/10 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-barn-red transition hover:bg-barn-red/20 ember-glow disabled:opacity-50";

/** Shared shell for the sign-in, verification, and password pages. */
export default function AuthCard({
	subtitle = "SOW · GROW · HARVEST",
	children,
}: {
	subtitle?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm rounded-lg border border-plum/40 bg-barn p-8 ember-glow text-plum">
				<h1 className="mb-1 text-center text-3xl text-barn-red ember-text">
					GRANGE
				</h1>
				<p className="mb-6 text-center text-xs tracking-widest text-husk">
					{subtitle}
				</p>
				{children}
			</div>
		</div>
	);
}
