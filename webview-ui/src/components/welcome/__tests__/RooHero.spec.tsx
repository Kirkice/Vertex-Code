import { render, screen } from "@testing-library/react"

import RooHero from "../RooHero"

describe("RooHero", () => {
	it("renders a ripple dot-matrix logo as svg", () => {
		render(<RooHero />)

		const hero = screen.getByTestId("roo-hero")
		const logo = screen.getByRole("img", { name: "Vertex particle dot logo" })
		const circles = hero.querySelectorAll("circle.vertex-logo-dot")

		expect(hero).toBeInTheDocument()
		expect(logo.tagName.toLowerCase()).toBe("svg")
		expect(circles.length).toBeGreaterThan(0)
	})
})
