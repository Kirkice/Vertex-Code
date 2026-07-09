import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const TYPING_SPEED_MS = 42
const DELETING_SPEED_MS = 24
const HOLD_AFTER_TYPING_MS = 1400
const HOLD_AFTER_DELETING_MS = 320

type Phase = "typing" | "holding" | "deleting" | "idle"

const RooTips = () => {
	const { t } = useTranslation()
	const messages = useMemo(
		() => [
			t("chat:aboutVariants.0"),
			t("chat:aboutVariants.1"),
			t("chat:aboutVariants.2"),
			t("chat:aboutVariants.3"),
			t("chat:aboutVariants.4"),
		],
		[t],
	)
	const [messageIndex, setMessageIndex] = useState(0)
	const [visibleLength, setVisibleLength] = useState(0)
	const [phase, setPhase] = useState<Phase>("typing")
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
			return
		}

		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

		updatePreference()
		mediaQuery.addEventListener?.("change", updatePreference)

		return () => {
			mediaQuery.removeEventListener?.("change", updatePreference)
		}
	}, [])

	useEffect(() => {
		if (prefersReducedMotion) {
			setVisibleLength(messages[messageIndex]?.length ?? 0)
			setPhase("idle")
			return
		}

		const currentMessage = messages[messageIndex] ?? ""

		if (phase === "typing") {
			if (visibleLength < currentMessage.length) {
				const timer = window.setTimeout(() => {
					setVisibleLength((value) => value + 1)
				}, TYPING_SPEED_MS)

				return () => window.clearTimeout(timer)
			}

			const timer = window.setTimeout(() => {
				setPhase("holding")
			}, HOLD_AFTER_TYPING_MS)

			return () => window.clearTimeout(timer)
		}

		if (phase === "holding") {
			const timer = window.setTimeout(() => {
				setPhase("deleting")
			}, HOLD_AFTER_TYPING_MS)

			return () => window.clearTimeout(timer)
		}

		if (phase === "deleting") {
			if (visibleLength > 0) {
				const timer = window.setTimeout(() => {
					setVisibleLength((value) => value - 1)
				}, DELETING_SPEED_MS)

				return () => window.clearTimeout(timer)
			}

			const timer = window.setTimeout(() => {
				setMessageIndex((value) => (value + 1) % messages.length)
				setPhase("typing")
			}, HOLD_AFTER_DELETING_MS)

			return () => window.clearTimeout(timer)
		}
	}, [messageIndex, messages, phase, prefersReducedMotion, visibleLength])

	const currentMessage = messages[messageIndex] ?? ""
	const typedMessage = prefersReducedMotion ? currentMessage : currentMessage.slice(0, visibleLength)

	return (
		<div className="flex flex-col gap-2 mb-4 max-w-[620px] text-vscode-descriptionForeground items-center text-center">
			<style>{`
				@keyframes vertex-type-caret-blink {
					0%, 49% { opacity: 1; }
					50%, 100% { opacity: 0; }
				}

				.vertex-type-caret {
					display: inline-block;
					margin-left: 2px;
					animation: vertex-type-caret-blink 1s step-end infinite;
				}

				@media (prefers-reduced-motion: reduce) {
					.vertex-type-caret {
						animation: none;
						opacity: 0.75;
					}
				}
			`}</style>
			<p className="my-0 pr-2 min-h-[24px]" data-testid="roo-typed-copy">
				<span>{typedMessage}</span>
				<span aria-hidden="true" className="vertex-type-caret" data-testid="roo-type-caret">
					|
				</span>
			</p>
		</div>
	)
}

export default RooTips
