import colors from "kleur";
import mri from "mri";
import { applyPreset, detectAdder, exit, getAdderMetadata, getChoices, getEnvironment, getFolderInfo, getToolCommand, installDependencies, npxs, packageManagers, runAdder } from "./index.js";

// Show the package version to make debugging easier
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");
let [year, month, day, iteration] = pkg.version.split(".");
if (month.length === 1) month = "0" + month;
day = day.replace("-", "");
if (day.length === 1) day = "0" + day;
if (iteration.length === 1) iteration = "0" + iteration;
const version = `${year}.${month}.${day}.${iteration}`;

const main = async () => {
	console.log(`${colors.bold("➕ Svelte Add")} (Version ${version})`);

	const args = process.argv.slice(2);
	const { _: passedAddersAndPresetsSeparated, demos: passedDemos, install: passedInstall, ...passedArgs } = mri(args);
	const passedPackageManager = passedArgs["package-manager"];
	delete passedArgs["package-manager"];
	const passedAddersAndPresetsJoined = passedAddersAndPresetsSeparated.join("+");
	const passedAddersAndPresets = passedAddersAndPresetsJoined === "" ? undefined : passedAddersAndPresetsJoined.split("+");

	const environment = await getEnvironment();
	const { adderOptions, deploy, install, npx, packageManager, other, presets, projectDirectory, quality, script, styleFramework, styleLanguage } = await getChoices({
		passedAddersAndPresets,
		defaultDemos: false,
		defaultInstall: false,
		outputFolderMustBe: true,
		environment,
		passedArgs,
		passedDemos,
		passedInstall,
		passedOutput: passedAddersAndPresets ? ["."] : [],
		passedPackageManager,
	});

	console.log("The project directory you're giving to this command cannot be determined to be guaranteed fresh — maybe it is, maybe it isn't. If any issues arise after running this command, please try again, making sure you've run it on a freshly initialized SvelteKit or Vite–Svelte app template.");

	const features = [script, styleLanguage, ...(styleFramework ? [styleFramework] : []), ...other, ...quality, ...(deploy ? [deploy] : [])];
	const adders = features.filter((feature) => !["css", "javascript"].includes(feature));

	const npxCommand = getToolCommand({ platform: environment.platform, tool: npx, tools: npxs });
	for (const preset of presets) {
		console.log();
		console.log(colors.bold(preset));
		await applyPreset({ args, projectDirectory, npxCommand, preset });
		console.log(`${colors.green(` ✅ has been set up, but because it's an external integration adder, cannot be determined to have been set up correctly.`)}\nCreate or find an existing issue at ${colors.cyan(`https://github.com/${preset}/issues`)} if this is wrong.`);
	}

	let folderInfo = await getFolderInfo({ projectDirectory });

	/** @type {Set<string>} */
	const addersToRepair = new Set();
	/** @type {Set<string>} */
	const addersToSkip = new Set();

	for (const adder of adders) {
		let preRunCheck;

		try {
			preRunCheck = await detectAdder({
				adder,
				projectDirectory,
				folderInfo,
			});
		} catch (/** @type {any} */ e) {
			console.log();
			console.log(colors.bold(adder));

			if (e.code === "ERR_MODULE_NOT_FOUND") exit(`${colors.red(`  ❌ doesn't exist as an adder.`)} Have you spelled it correctly?\nCreate or find an existing issue at ${colors.cyan("https://github.com/svelte-add/svelte-add/issues")} if this is wrong.`);

			throw e;
		}

		if (Object.values(preRunCheck).every(Boolean)) {
			const { name } = await getAdderMetadata({ adder });
			console.log();
			console.log(colors.bold(name));
			console.log(`${colors.green(` ✅ already set up! skipping.`)}\nCreate or find an existing issue at ${colors.cyan("https://github.com/svelte-add/svelte-add/issues")} if this is wrong.`);
			addersToSkip.add(adder);
		} else if (Object.values(preRunCheck).some(Boolean)) {
			addersToRepair.add(adder);
		}
	}

	for (const adder of adders) {
		if (addersToSkip.has(adder)) continue;

		try {
			await runAdder({
				adder,
				projectDirectory,
				environment,
				folderInfo,
				npxCommand,
				options: adderOptions[adder],
			});
		} catch (e) {
			const { name } = await getAdderMetadata({ adder });

			console.log();
			console.log(colors.bold(name));

			throw e;
		}

		// The folder info has changed because it now has the integration!
		folderInfo = await getFolderInfo({ projectDirectory });
	}

	for (const adder of adders) {
		const postRunCheck = await detectAdder({
			adder,
			projectDirectory,
			folderInfo,
		});

		if (!Object.values(postRunCheck).every(Boolean)) {
			const { name } = await getAdderMetadata({ adder });

			console.log();
			console.log(colors.bold(name));
			for (const [description, passed] of Object.entries(postRunCheck)) {
				if (passed) console.log(colors.green(`  ✅ ${description}`));
				else console.log(colors.red(`  ❌ ${description}`));
			}

			if (addersToSkip.has(adder)) console.error(`\n${colors.red(`  ❌ was working before this but is not anymore?! (see above)`)}\nThis is definitely not supposed to happen, so please create or find an existing issue at ${colors.cyan("https://github.com/svelte-add/svelte-add/issues")} with the full command output.`);
			else console.error(`\n${colors.red(`  ❌ was supposed to be set up for you but it appears not to have been?! (see above)`)}\nThis is definitely not supposed to happen, so please create or find an existing issue at ${colors.cyan("https://github.com/svelte-add/svelte-add/issues")} with the full command output.`);
		} else {
			if (addersToSkip.has(adder)) continue;

			const { name } = await getAdderMetadata({ adder });

			console.log();
			console.log(colors.bold(name));
			console.log(`${colors.green(addersToRepair.has(adder) ? ` ✅ successfully set up and repaired (it looks like it was in a broken setup before this command was run)!` : ` ✅ successfully set up!`)}\nCreate or find an existing issue at ${colors.cyan("https://github.com/svelte-add/svelte-add/issues")} if this is wrong.`);
		}
	}

	const packageManagerCommand = getToolCommand({ platform: environment.platform, tool: packageManager, tools: packageManagers });
	if (install) await installDependencies({ projectDirectory, packageManagerCommand });
	else {
		// TODO: print message instructing
	}
};

main();
