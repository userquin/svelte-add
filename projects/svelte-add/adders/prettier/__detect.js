/** @type {import("../..").Heuristic[]} */
export const heuristics = [
	{
		description: "`prettier` is installed",
		async detector({ folderInfo }) {
			return "prettier" in folderInfo.allDependencies;
		},
	},
	{
		description: "`.prettierrc` exists",
		async detector({ readFile }) {
			const prettierrc = await readFile({ path: "/.prettierrc" });

			return prettierrc.exists;
		},
	},
];
