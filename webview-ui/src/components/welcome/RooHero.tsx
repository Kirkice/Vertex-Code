import type { CSSProperties } from "react"

type Dot = {
	cx: number
	cy: number
	radius: number
	delay: number
	opacity: number
	pulse: number
}

const GRID_SIZE = 17
const CELL_SIZE = 6
const VIEWBOX_SIZE = GRID_SIZE * CELL_SIZE
const CENTER = (GRID_SIZE - 1) / 2
const INNER_RADIUS = 0
const OUTER_RADIUS = 6.7

type DotStyle = CSSProperties & {
	"--dot-delay": string
	"--dot-opacity": string
	"--dot-pulse": string
}

const getDotStyle = (dot: Dot): DotStyle => ({
	"--dot-delay": `${dot.delay}s`,
	"--dot-opacity": dot.opacity.toFixed(3),
	"--dot-pulse": dot.pulse.toFixed(3),
	opacity: dot.opacity,
})

const dots: Dot[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
	const x = index % GRID_SIZE
	const y = Math.floor(index / GRID_SIZE)
	const dx = x - CENTER
	const dy = y - CENTER
	const distance = Math.hypot(dx, dy)

	if (distance < INNER_RADIUS || distance > OUTER_RADIUS) {
		return null
	}

	const normalized = (distance - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS)
	const pulse = 0.95 + (1 - normalized) * 1.65

	return {
		cx: x * CELL_SIZE + CELL_SIZE / 2,
		cy: y * CELL_SIZE + CELL_SIZE / 2,
		radius: 0.72 + (1 - normalized) * 0.78,
		delay: normalized * 1.6,
		opacity: 0.22 + (1 - normalized) * 0.44,
		pulse,
	}
}).filter((dot): dot is Dot => dot !== null)

const RooHero = () => {
	return (
		<div className="mb-4 flex flex-col items-center" data-testid="roo-hero">
			<style>{`
				@keyframes vertex-dot-ripple {
					0%, 100% {
						opacity: var(--dot-opacity, 0.35);
						transform: scale(1);
						filter: drop-shadow(0 0 0 rgba(244, 244, 245, 0));
					}
					22% {
						opacity: calc(var(--dot-opacity, 0.35) + 0.28);
						transform: scale(var(--dot-pulse, 1.6));
						filter: drop-shadow(0 0 4px rgba(244, 244, 245, 0.22));
					}
					50% {
						opacity: calc(var(--dot-opacity, 0.35) + 0.08);
						transform: scale(1.08);
						filter: drop-shadow(0 0 2px rgba(244, 244, 245, 0.08));
					}
				}

				.vertex-logo-dot {
					transform-box: fill-box;
					transform-origin: center;
					animation: vertex-dot-ripple 3.6s ease-in-out infinite;
					animation-delay: var(--dot-delay, 0s);
					will-change: opacity, transform, filter;
				}

				@media (prefers-reduced-motion: reduce) {
					.vertex-logo-dot {
						animation: none;
						opacity: calc(var(--dot-opacity, 0.35) + 0.08);
						transform: scale(1);
						filter: none;
					}
				}
			`}</style>
			<svg
				width="96"
				height="96"
				viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
				fill="none"
				role="img"
				aria-label="Vertex ripple dot logo"
				className="mx-auto overflow-visible text-vscode-foreground">
				<title>Vertex ripple dot logo</title>
				{dots.map((dot, index) => (
					<circle
						key={`${dot.cx}-${dot.cy}-${index}`}
						className="vertex-logo-dot"
						cx={dot.cx}
						cy={dot.cy}
						r={dot.radius}
						fill="currentColor"
						style={getDotStyle(dot)}
					/>
				))}
			</svg>
		</div>
	)
}

export default RooHero
