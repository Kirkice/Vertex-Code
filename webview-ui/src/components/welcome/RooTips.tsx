import { Trans } from "react-i18next"

const RooTips = () => {
	return (
		<div className="flex flex-col gap-2 mb-4 max-w-[500px] text-vscode-descriptionForeground items-center text-center">
			<p className="my-0 pr-2">
				<Trans i18nKey="chat:about" />
			</p>
		</div>
	)
}

export default RooTips