import { useState } from "react"

const RooHero = () => {
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<div className="mb-4 flex flex-col items-center">
			<img src={imagesBaseUri + "/panel_light.png"} alt="Vertex logo" width={96} height={96} className="mx-auto" />
		</div>
	)
}

export default RooHero