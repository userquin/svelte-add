/** @type {import("../..").Heuristic[]} */
export const heuristics = [
	{
		description: "`unplugin-icons` is installed",
		async detector({ folderInfo }) {
			return "unplugin-icons" in folderInfo.allDependencies;
		},
	},
	{
		description: "`unplugin-icons` plugin is set up in `svelte.config.js`",
		async detector({ readFile }) {
			// check first if installed
			const unpluginIconsIsProbablySetup = (text) => {
				return text.includes("unplugin-icons/vite");
			};

			const js = await readFile({ path: "/svelte.config.js" });
			const cjs = await readFile({ path: "/svelte.config.cjs" });
			const viteJs = await readFile({ path: "/vite.config.js" });

			if (js.exists) {
				return unpluginIconsIsProbablySetup(js.text);
			} else if (cjs.exists) {
				return unpluginIconsIsProbablySetup(cjs.text);
			} else if (viteJs.exists) {
				return unpluginIconsIsProbablySetup(viteJs.text);
			}

			return false;
		},
	},
];
