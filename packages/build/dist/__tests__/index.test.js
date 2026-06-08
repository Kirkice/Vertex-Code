// npx vitest run src/__tests__/index.test.ts
import { generatePackageJson } from "../index.js";
describe("generatePackageJson", () => {
    it("should be a test", () => {
        const generatedPackageJson = generatePackageJson({
            packageJson: {
                name: "roo-cline",
                displayName: "%extension.displayName%",
                description: "%extension.description%",
                publisher: "RooVeterinaryInc",
                version: "3.17.2",
                icon: "assets/icons/icon.png",
                contributes: {
                    viewsContainers: {
                        activitybar: [
                            {
                                id: "roo-cline-ActivityBar",
                                title: "%views.activitybar.title%",
                                icon: "assets/icons/icon.svg",
                            },
                        ],
                    },
                    views: {
                        "roo-cline-ActivityBar": [
                            {
                                type: "webview",
                                id: "roo-cline.SidebarProvider",
                                name: "",
                            },
                        ],
                    },
                    commands: [
                        {
                            command: "roo-cline.plusButtonClicked",
                            title: "%command.newTask.title%",
                            icon: "$(edit)",
                        },
                        {
                            command: "roo-cline.openInNewTab",
                            title: "%command.openInNewTab.title%",
                            category: "%configuration.title%",
                        },
                    ],
                    menus: {
                        "editor/context": [
                            {
                                submenu: "roo-cline.contextMenu",
                                group: "navigation",
                            },
                        ],
                        "roo-cline.contextMenu": [
                            {
                                command: "roo-cline.addToContext",
                                group: "1_actions@1",
                            },
                        ],
                        "editor/title": [
                            {
                                command: "roo-cline.plusButtonClicked",
                                group: "navigation@1",
                                when: "activeWebviewPanelId == roo-cline.TabPanelProvider",
                            },
                            {
                                command: "roo-cline.settingsButtonClicked",
                                group: "navigation@6",
                                when: "activeWebviewPanelId == roo-cline.TabPanelProvider",
                            },
                            {
                                command: "roo-cline.accountButtonClicked",
                                group: "navigation@6",
                                when: "activeWebviewPanelId == roo-cline.TabPanelProvider",
                            },
                        ],
                    },
                    submenus: [
                        {
                            id: "roo-cline.contextMenu",
                            label: "%views.contextMenu.label%",
                        },
                        {
                            id: "roo-cline.terminalMenu",
                            label: "%views.terminalMenu.label%",
                        },
                    ],
                    configuration: {
                        title: "%configuration.title%",
                        properties: {
                            "roo-cline.allowedCommands": {
                                type: "array",
                                items: {
                                    type: "string",
                                },
                                default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
                                description: "%commands.allowedCommands.description%",
                            },
                            "roo-cline.customStoragePath": {
                                type: "string",
                                default: "",
                                description: "%settings.customStoragePath.description%",
                            },
                        },
                    },
                },
                scripts: {
                    lint: "eslint **/*.ts",
                },
            },
            overrideJson: {
                name: "vertex-nightly",
                displayName: "Vertex Nightly",
                publisher: "VertexOrganization",
                version: "0.0.1",
                icon: "assets/icons/icon-nightly.png",
                scripts: {},
            },
            substitution: ["roo-cline", "vertex-nightly"],
        });
        expect(generatedPackageJson).toStrictEqual({
            name: "vertex-nightly",
            displayName: "Vertex Nightly",
            description: "%extension.description%",
            publisher: "VertexOrganization",
            version: "0.0.1",
            icon: "assets/icons/icon-nightly.png",
            contributes: {
                viewsContainers: {
                    activitybar: [
                        {
                            id: "vertex-nightly-ActivityBar",
                            title: "%views.activitybar.title%",
                            icon: "assets/icons/icon.svg",
                        },
                    ],
                },
                views: {
                    "vertex-nightly-ActivityBar": [
                        {
                            type: "webview",
                            id: "vertex-nightly.SidebarProvider",
                            name: "",
                        },
                    ],
                },
                commands: [
                    {
                        command: "vertex-nightly.plusButtonClicked",
                        title: "%command.newTask.title%",
                        icon: "$(edit)",
                    },
                    {
                        command: "vertex-nightly.openInNewTab",
                        title: "%command.openInNewTab.title%",
                        category: "%configuration.title%",
                    },
                ],
                menus: {
                    "editor/context": [
                        {
                            submenu: "vertex-nightly.contextMenu",
                            group: "navigation",
                        },
                    ],
                    "vertex-nightly.contextMenu": [
                        {
                            command: "vertex-nightly.addToContext",
                            group: "1_actions@1",
                        },
                    ],
                    "editor/title": [
                        {
                            command: "vertex-nightly.plusButtonClicked",
                            group: "navigation@1",
                            when: "activeWebviewPanelId == vertex-nightly.TabPanelProvider",
                        },
                        {
                            command: "vertex-nightly.settingsButtonClicked",
                            group: "navigation@6",
                            when: "activeWebviewPanelId == vertex-nightly.TabPanelProvider",
                        },
                        {
                            command: "vertex-nightly.accountButtonClicked",
                            group: "navigation@6",
                            when: "activeWebviewPanelId == vertex-nightly.TabPanelProvider",
                        },
                    ],
                },
                submenus: [
                    {
                        id: "vertex-nightly.contextMenu",
                        label: "%views.contextMenu.label%",
                    },
                    {
                        id: "vertex-nightly.terminalMenu",
                        label: "%views.terminalMenu.label%",
                    },
                ],
                configuration: {
                    title: "%configuration.title%",
                    properties: {
                        "vertex-nightly.allowedCommands": {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
                            description: "%commands.allowedCommands.description%",
                        },
                        "vertex-nightly.customStoragePath": {
                            type: "string",
                            default: "",
                            description: "%settings.customStoragePath.description%",
                        },
                    },
                },
            },
            scripts: {},
        });
    });
});
