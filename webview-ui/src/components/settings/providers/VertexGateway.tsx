import { useEffect, useMemo } from "react"
import {
	type ProviderSettings,
	type OrganizationAllowList,
	type RouterModels,
	vertexGatewayDefaultModelId,
} from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { getVertexAuthUrl } from "@src/oauth/urls"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { ModelPicker } from "../ModelPicker"
import { ApiErrorMessage } from "../ApiErrorMessage"

type VertexGatewayProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	simplifySettings?: boolean
}

function isClaudeSonnetModelId(id: string) {
	return /claude.*sonnet/i.test(id)
}

// Exported for unit tests. Picks the default Vertex Gateway model id, preferring
// Claude Sonnet 4.5 → Sonnet 4 → first available Sonnet → first model overall.
export function pickVertexGatewayDefaultModelId(modelIds: string[]) {
	if (modelIds.length === 0) {
		return vertexGatewayDefaultModelId
	}

	const sonnets = modelIds.filter(isClaudeSonnetModelId)
	if (sonnets.length === 0) {
		return modelIds[0]
	}

	return (
		sonnets.find((id) => id === "anthropic/claude-sonnet-4.5") ??
		sonnets.find((id) => id.includes("claude-sonnet-4.5")) ??
		sonnets.find((id) => /sonnet-4[.-]5/i.test(id)) ??
		sonnets.find((id) => /sonnet-4(?![.-]?\d)/i.test(id)) ??
		sonnets[0]
	)
}

export const VertexGateway = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
	modelValidationError,
	simplifySettings,
}: VertexGatewayProps) => {
	const { t } = useAppTranslation()
	const { vertexIsAuthenticated, vertexUserEmail, vertexUserName, vertexBaseUrl, uriScheme, deviceName } =
		useExtensionState()

	const authUrl = getVertexAuthUrl(uriScheme, vertexBaseUrl, deviceName)
	const resolvedDashboardBase = vertexBaseUrl?.replace(/\/$/, "") || "https://www.vertex.dev"

	const vertexModels = useMemo(() => routerModels?.["vertex-gateway"] ?? {}, [routerModels])
	const modelIds = useMemo(() => Object.keys(vertexModels), [vertexModels])
	const resolvedDefaultModelId = useMemo(() => pickVertexGatewayDefaultModelId(modelIds), [modelIds])

	useEffect(() => {
		if (modelIds.length === 0) {
			return
		}

		const current = apiConfiguration.vertexGatewayModelId
		if (!current || !modelIds.includes(current)) {
			setApiConfigurationField("vertexGatewayModelId", resolvedDefaultModelId)
		}
	}, [apiConfiguration.vertexGatewayModelId, modelIds, resolvedDefaultModelId, setApiConfigurationField])

	return (
		<>
			<div className="flex flex-col gap-1 rounded-md border border-vscode-panel-border p-2">
				<div className="flex items-center justify-between">
					<label className="block text-sm font-medium">{t("settings:providers.vertexGateway.account")}</label>
					{vertexIsAuthenticated && vertexUserEmail && (
						<span className="text-xs text-vscode-descriptionForeground">{vertexUserEmail}</span>
					)}
				</div>
				{!vertexIsAuthenticated ? (
					<div className="flex flex-col gap-1">
						<ApiErrorMessage errorMessage={t("settings:validation.vertexGatewaySignIn")} />
						<p className="text-xs text-vscode-descriptionForeground">
							{t("settings:providers.vertexGateway.signInDescription")}
						</p>
						<VSCodeButtonLink href={authUrl} appearance="primary">
							{t("settings:providers.vertexGateway.signInButton")}
						</VSCodeButtonLink>
					</div>
				) : (
					<div className="flex items-center gap-1">
						<span className="codicon codicon-check text-vscode-charts-green" />
						<span className="text-xs text-vscode-descriptionForeground">
							{vertexUserName
								? t("settings:providers.vertexGateway.authenticatedAs", { name: vertexUserName })
								: t("settings:providers.vertexGateway.authenticated")}
						</span>
					</div>
				)}
			</div>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={resolvedDefaultModelId}
				models={vertexModels}
				modelIdKey="vertexGatewayModelId"
				serviceName="Vertex Gateway"
				serviceUrl={`${resolvedDashboardBase}/dashboard/models`}
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
				simplifySettings={simplifySettings}
			/>
		</>
	)
}
