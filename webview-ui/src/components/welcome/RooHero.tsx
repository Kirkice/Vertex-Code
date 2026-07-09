import type { CSSProperties } from "react"

type Dot = {
	cx: number
	cy: number
	radius: number
	opacity: number
	driftX: number
	driftY: number
	delay: number
	duration: number
	pulse: number
}

const GRID_SIZE = 29
const CELL_SIZE = 3.6
const VIEWBOX_SIZE = GRID_SIZE * CELL_SIZE
const CENTER = (GRID_SIZE - 1) / 2
const OUTER_RADIUS = 12.3

const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
	return t * t * (3 - 2 * t)
}

type DotStyle = CSSProperties & {
	"--dot-opacity": string
	"--dot-drift-x": string
	"--dot-drift-y": string
	"--dot-delay": string
	"--dot-duration": string
	"--dot-pulse": string
}

const dots: Dot[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
	const x = index % GRID_SIZE
	const y = Math.floor(index / GRID_SIZE)
	const dx = x - CENTER
	const dy = y - CENTER
	const distance = Math.hypot(dx, dy)

	if (distance > OUTER_RADIUS) {
		return null
	}

	const normalized = distance / OUTER_RADIUS
	const directionX = distance === 0 ? 0 : dx / distance
	const directionY = distance === 0 ? 0 : dy / distance
	const tangentialX = -directionY
	const tangentialY = directionX
	const driftStrength = 0.7 + normalized * 3.2
	const swirlBias = ((x + y) % 2 === 0 ? 1 : -1) * 0.5
	const corePresence = 1 - smoothstep(0.55, 1, normalized)
	const edgeFeather = 1 - smoothstep(0.78, 1, normalized)
	const opacity = 0.04 + corePresence * 0.42 + edgeFeather * 0.1
	const radius = 0.38 + corePresence * 0.42 + edgeFeather * 0.14

	return {
		cx: x * CELL_SIZE + CELL_SIZE / 2,
		cy: y * CELL_SIZE + CELL_SIZE / 2,
		radius: Number(radius.toFixed(3)),
		opacity: Number(opacity.toFixed(3)),
		driftX: Number((directionX * driftStrength + tangentialX * swirlBias).toFixed(3)),
		driftY: Number((directionY * driftStrength + tangentialY * swirlBias).toFixed(3)),
		delay: Number((normalized * 1.15 + ((x * 3 + y * 5) % 7) * 0.045).toFixed(3)),
		duration: Number((4.8 + normalized * 1.1).toFixed(3)),
		pulse: Number((1.08 + (1 - normalized) * 0.26).toFixed(3)),
	}
}).filter((dot): dot is Dot => dot !== null)

const getDotStyle = (dot: Dot): DotStyle => ({
	"--dot-opacity": dot.opacity.toFixed(3),
	"--dot-drift-x": `${dot.driftX}px`,
	"--dot-drift-y": `${dot.driftY}px`,
	"--dot-delay": `${dot.delay}s`,
	"--dot-duration": `${dot.duration}s`,
	"--dot-pulse": dot.pulse.toFixed(3),
	opacity: dot.opacity,
})

type RooHeroProps = {
	size?: number
}

const RooHero = ({ size = 128 }: RooHeroProps) => {
	return (
		<div className="mb-4 flex flex-col items-center" data-testid="roo-hero">
			<style>{`
				@keyframes vertex-dot-reassemble {
					0% {
						opacity: calc(var(--dot-opacity, 0.35) * 0.18);
						transform: translate(var(--dot-drift-x, 0px), var(--dot-drift-y, 0px)) scale(0.68);
						filter: drop-shadow(0 0 0 rgba(244, 244, 245, 0));
					}
					24% {
						opacity: calc(var(--dot-opacity, 0.35) + 0.12);
						transform: translate(calc(var(--dot-drift-x, 0px) * 0.42), calc(var(--dot-drift-y, 0px) * 0.42)) scale(0.9);
						filter: drop-shadow(0 0 2px rgba(244, 244, 245, 0.06));
					}
					48% {
						opacity: calc(var(--dot-opacity, 0.35) + 0.3);
						transform: translate(0px, 0px) scale(var(--dot-pulse, 1.14));
						filter: drop-shadow(0 0 6px rgba(244, 244, 245, 0.22));
					}
					68% {
						opacity: calc(var(--dot-opacity, 0.35) + 0.06);
						transform: translate(0px, 0px) scale(1);
						filter: drop-shadow(0 0 2px rgba(244, 244, 245, 0.08));
					}
					100% {
						opacity: calc(var(--dot-opacity, 0.35) * 0.28);
						transform: translate(calc(var(--dot-drift-x, 0px) * -0.2), calc(var(--dot-drift-y, 0px) * -0.2)) scale(0.82);
						filter: drop-shadow(0 0 0 rgba(244, 244, 245, 0));
					}
				}

				.vertex-logo-dot {
					transform-box: fill-box;
					transform-origin: center;
					animation: vertex-dot-reassemble var(--dot-duration, 5.4s) cubic-bezier(0.22, 1, 0.36, 1) infinite;
					animation-delay: var(--dot-delay, 0s);
					will-change: opacity, transform, filter;
				}

				@media (prefers-reduced-motion: reduce) {
					.vertex-logo-dot {
						animation: none;
						opacity: calc(var(--dot-opacity, 0.35) + 0.08);
						transform: translate(0px, 0px) scale(1);
						filter: none;
					}
				}
			`}</style>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
				fill="none"
				role="img"
				aria-label="Vertex particle dot logo"
				className="mx-auto overflow-visible text-vscode-foreground">
				<title>Vertex particle dot logo</title>
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
