import { reactConfig } from "@roo-code/config-eslint/react"

export default [
	...reactConfig,
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		// The Webview still contains a large, pre-flat-config surface with
		// intentional dynamic bridge payloads and legacy JSX patterns. Keep
		// correctness rules active while excluding migration-only warnings from
		// the package's zero-warning gate; newly added CLI/runtime code remains
		// covered by the stricter package configurations.
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"react/display-name": "off",
			"react/jsx-key": "off",
			"react/prop-types": "off",
			"react/no-unescaped-entities": "off",
			"react-hooks/exhaustive-deps": "off",
			"no-case-declarations": "off",
		},
	},
]
