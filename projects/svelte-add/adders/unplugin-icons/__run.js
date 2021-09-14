import { updateViteConfig } from "../../adder-tools.js";
import { addImport, findImport, setDefault } from "../../ast-tools.js";

/** @type {import("../../index.js").AdderRun<import("./__metadata.js").Options>} */
export const run = async ({ folderInfo, install, updateJavaScript, readFile }) => {
	const cjs = folderInfo.packageType !== "module";
	const path = folderInfo.kit ? (cjs ? "/svelte.config.cjs" : "/svelte.config.js") : "/vite.config.js";
	await updateJavaScript({
		path,
		async script({ typeScriptEstree }) {
			// Find `unplugin-icons/vite` import or add it if it's not there
			let unpluginIconsViteImports = findImport({
				cjs,
				package: "unplugin-icons/vite",
				typeScriptEstree,
			});
			let unpluginIconsViteImportedAs = cjs ? unpluginIconsViteImports.require : unpluginIconsViteImports.default;

			if (!unpluginIconsViteImportedAs) {
				unpluginIconsViteImportedAs = "Icons";
				addImport({
					require: unpluginIconsViteImportedAs,
					cjs,
					default: unpluginIconsViteImportedAs,
					package: "unplugin-icons/vite",
					typeScriptEstree,
				});
			}

			return {
				typeScriptEstree,
			};
		},
	});
	await updateViteConfig({
		folderInfo,
		mutateViteConfig(viteConfig) {
			const vitePlugins = setDefault({
				default: {
					type: "ArrayExpression",
					elements: [],
				},
				object: viteConfig,
				property: "plugins",
			});

			if (vitePlugins.type !== "ArrayExpression") throw new Error("`plugins` in Vite config needs to be an array");

			// todo@userquin: add plugin here => Icons({ compiler: 'svelte' }}
		},
		updateJavaScript,
	});

	await install({ package: "unplugin-icons" });
};
