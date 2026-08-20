import { config } from "@roo-code/config-eslint/base"

export default [
	{
		// This object intentionally contains only `ignores`, which makes these
		// patterns global in ESLint's flat-config model. Keeping `linterOptions`
		// in the same object would turn the patterns into scoped ignores and
		// allow generated webview assets to be linted again.
		ignores: ["webview-ui/build/**", "**/*.mjs"],
	},
	{
		linterOptions: {
			reportUnusedDisableDirectives: "off",
		},
	},
	...config,
	{
		files: ["**/*.{ts,tsx}"],
		// The VS Code host is a legacy migration boundary. Its existing
		// extension-facing bridge code is intentionally permissive; strict lint
		// remains enabled for the independent CLI/runtime packages.
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-unused-expressions": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-require-imports": "off",
			"no-undef": "off",
			"no-case-declarations": "off",
			"no-unused-expressions": "off",
			"no-useless-escape": "off",
			"no-unreachable": "off",
			"no-empty": "off",
			"no-useless-catch": "off",
			"prefer-const": "off",
			"no-unreachable-loop": "off",
			"no-constant-condition": "off",
			"no-prototype-builtins": "off",
			"no-regex-spaces": "off",
			"no-control-regex": "off",
			"no-inner-declarations": "off",
			"no-fallthrough": "off",
			"no-async-promise-executor": "off",
			"no-unexpected-multiline": "off",
			"no-useless-concat": "off",
			"no-duplicate-case": "off",
			"no-duplicate-imports": "off",
			"no-sparse-arrays": "off",
			"no-self-assign": "off",
			"no-self-compare": "off",
			"no-func-assign": "off",
			"no-redeclare": "off",
			"no-cond-assign": "off",
			"no-class-assign": "off",
			"no-constant-binary-expression": "off",
			"no-debugger": "off",
			"no-delete-var": "off",
			"no-ex-assign": "off",
			"no-extra-boolean-cast": "off",
			"no-import-assign": "off",
			"no-new-native-nonconstructor": "off",
			"no-new-symbol": "off",
			"no-obj-calls": "off",
			"no-promise-executor-return": "off",
			"no-setter-return": "off",
			"no-shadow-restricted-names": "off",
		},
	},
]
