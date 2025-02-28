import { walk } from "estree-walker";

/**
 * @param {object} param0
 * @param {import("estree").ObjectExpression} param0.object
 * @param {string} param0.property
 * @returns {import("estree").Property | undefined}
 */
export const getProperty = ({ object, property: propertyName }) => {
	/** @type {import("estree").Property | undefined} */
	let matchingProperty;
	for (const property of object.properties) {
		if (property.type !== "Property") continue;
		if (property.key.type !== "Identifier") continue;
		if (property.key.name !== propertyName) continue;

		matchingProperty = property;
	}

	return matchingProperty;
};

/**
 * @param {object} param0
 * @param {import("estree").ObjectExpression} param0.object
 * @param {string} param0.property
 * @param {import("estree").Expression} param0.value
 * @returns {void}
 */
export const setPropertyValue = ({ object, property, value }) => {
	let matchingProperty = getProperty({ object, property });
	if (matchingProperty) {
		matchingProperty.value = value;
	} else {
		matchingProperty = {
			type: "Property",
			computed: false,
			key: {
				type: "Identifier",
				name: property,
			},
			kind: "init",
			method: false,
			shorthand: false,
			value,
		};

		object.properties.push(matchingProperty);
	}
};

/**
 * @template {import("estree").Expression} Default
 * @param {object} param0
 * @param {Default} param0.default
 * @param {import("estree").ObjectExpression} param0.object
 * @param {string} param0.property
 * @returns {import("estree").Expression}
 */
export const setDefault = ({ default: defaultValue, object, property }) => {
	const matchingProperty = getProperty({ object, property });

	if (matchingProperty && matchingProperty.value.type !== "ArrayPattern" && matchingProperty.value.type !== "AssignmentPattern" && matchingProperty.value.type !== "ObjectPattern" && matchingProperty.value.type !== "RestElement") {
		return matchingProperty.value;
	} else {
		setPropertyValue({ object, property, value: defaultValue });
	}
	return defaultValue;
};

/**
 * @param {object} param0
 * @param {boolean} param0.cjs
 * @param {import("./ast-io.js").RecastAST} param0.typeScriptEstree
 * @returns {import("estree").Expression}
 */
export const getConfigExpression = ({ cjs, typeScriptEstree }) => {
	/** @type {string | undefined} */
	let configObjectVariable;

	/** @type {import("estree").Expression | undefined} */
	let configExpression;

	// Try to find the exported config object
	walk(typeScriptEstree, {
		enter(node) {
			if (cjs) {
				if (node.type !== "AssignmentExpression") return;
				/** @type {import("estree").AssignmentExpression} */
				// prettier-ignore
				const assignmentExpression = (node)

				const assigningTo = assignmentExpression.left;
				if (assigningTo.type !== "MemberExpression") return;

				if (assigningTo.object.type !== "Identifier") return;
				if (assigningTo.object.name !== "module") return;

				if (assigningTo.property.type !== "Identifier") return;
				if (assigningTo.property.name !== "exports") return;

				const assignedTo = assignmentExpression.right;
				if (assignedTo.type === "Identifier") {
					configObjectVariable = assignedTo.name;
				} else {
					configExpression = assignedTo;
				}
			} else {
				if (node.type !== "ExportDefaultDeclaration") return;

				/** @type {import("estree").ExportDefaultDeclaration} */
				// prettier-ignore
				const exportDefault = (node);

				const exportDefaultDeclaration = exportDefault.declaration;

				if (exportDefaultDeclaration.type === "Identifier") {
					configObjectVariable = exportDefaultDeclaration.name;
				} else {
					if (exportDefaultDeclaration.type === "VariableDeclaration") throw new Error("?!?! default export is a VariableDeclaration");
					if (exportDefaultDeclaration.type === "FunctionDeclaration") throw new Error("?!?! default export is a FunctionDeclaration");
					if (exportDefaultDeclaration.type === "ClassDeclaration") throw new Error("?!?! default export is a ClassDeclaration");
					configExpression = exportDefaultDeclaration;
				}
			}
		},
	});

	if (!configExpression) {
		if (!configObjectVariable) {
			configExpression = {
				type: "ObjectExpression",
				properties: [],
			};

			configObjectVariable = "config";

			/** @type {import("estree").VariableDeclaration} */
			const declareConfig = {
				type: "VariableDeclaration",
				declarations: [
					{
						type: "VariableDeclarator",
						id: {
							type: "Identifier",
							name: configObjectVariable,
						},
						init: configExpression,
					},
				],
				kind: "const",
			};

			typeScriptEstree.program.body.push(declareConfig);

			if (cjs) {
				/** @type {import("estree").ExpressionStatement} */
				const exportConfig = {
					type: "ExpressionStatement",
					expression: {
						type: "AssignmentExpression",
						operator: "=",
						left: {
							type: "MemberExpression",
							object: {
								type: "Identifier",
								name: "module",
							},
							property: {
								type: "Identifier",
								name: "exports",
							},
							computed: false,
							optional: false,
						},
						right: {
							type: "Identifier",
							name: configObjectVariable,
						},
					},
				};

				typeScriptEstree.program.body.push(exportConfig);
			} else {
				/** @type {import("estree").ExportDefaultDeclaration} */
				const exportConfig = {
					type: "ExportDefaultDeclaration",
					declaration: {
						type: "Identifier",
						name: configObjectVariable,
					},
				};
				typeScriptEstree.program.body.push(exportConfig);
			}
		}

		walk(typeScriptEstree, {
			enter(node) {
				if (node.type !== "VariableDeclarator") return;

				/** @type {import("estree").VariableDeclarator} */
				// prettier-ignore
				const variableDeclarator = (node)

				if (variableDeclarator.id.type === "Identifier" && variableDeclarator.id.name === configObjectVariable) {
					const init = variableDeclarator.init;
					if (!init) return;
					if (init.type !== "ObjectExpression") return;
					configExpression = init;
				}
			},
		});
	}

	if (!configExpression) throw new Error(`TODO: make this work`);

	return configExpression;
};

/**
 * @param {object} param0
 * @param {boolean} param0.cjs
 * @param {string} param0.package
 * @param {import("./ast-io.js").RecastAST} param0.typeScriptEstree
 * @returns {{ default: string | undefined, named: Record<string, string>, require: string | undefined }}
 */
export const findImport = ({ cjs, package: pkg, typeScriptEstree }) => {
	/** @type {string | undefined} */
	let defaultImportedAs;
	/** @type {string | undefined} */
	let requiredAs;
	/** @type {Record<string, string>} */
	const named = {};

	walk(typeScriptEstree, {
		enter(node) {
			if (cjs) {
				if (node.type !== "VariableDeclarator") return;

				/** @type {import("estree").VariableDeclarator} */
				// prettier-ignore
				const declarator = (node);

				if (declarator.id.type !== "Identifier") return;
				const identifier = declarator.id;

				if (!declarator.init) return;
				if (declarator.init.type !== "CallExpression") return;
				const callExpression = declarator.init;

				if (callExpression.callee.type !== "Identifier") return;
				const callee = callExpression.callee;

				if (callee.name !== "require") return;

				if (callExpression.arguments[0].type !== "Literal") return;
				if (callExpression.arguments[0].value !== pkg) return;

				requiredAs = identifier.name;
			} else {
				if (node.type !== "ImportDeclaration") return;

				/** @type {import("estree").ImportDeclaration} */
				// prettier-ignore
				const importDeclaration = (node)

				if (importDeclaration.source.value !== pkg) return;

				for (const specifier of importDeclaration.specifiers) {
					if (specifier.type === "ImportDefaultSpecifier") defaultImportedAs = specifier.local.name;
					if (specifier.type === "ImportSpecifier") named[specifier.imported.name] = specifier.local.name;
				}
			}
		},
	});

	return {
		default: defaultImportedAs,
		named,
		require: requiredAs,
	};
};

/**
 * @param {object} param0
 * @param {boolean} param0.cjs
 * @param {string} [param0.default]
 * @param {Record<string, string>} [param0.named]
 * @param {string} param0.package
 * @param {string} [param0.require]
 * @param {import("./ast-io.js").RecastAST} param0.typeScriptEstree
 * @returns {void}
 */
export const addImport = ({ cjs, default: default_, named, package: pkg, require, typeScriptEstree }) => {
	if (cjs) {
		/** @type {import("estree").VariableDeclarator["id"]} */
		// prettier-ignore
		let id = ({});

		if (require)
			id = {
				type: "Identifier",
				name: require,
			};

		if (named) {
			id = {
				type: "ObjectPattern",
				properties: Object.entries(named).map(([exportedAs, importAs]) => ({
					type: "Property",
					computed: false,
					key: {
						type: "Identifier",
						name: exportedAs,
					},
					kind: "init",
					method: false,
					shorthand: exportedAs === importAs,
					value: {
						type: "Identifier",
						name: importAs,
					},
				})),
			};
		}

		/** @type {import("estree").VariableDeclaration} */
		const requirePackageAst = {
			type: "VariableDeclaration",
			declarations: [
				{
					type: "VariableDeclarator",
					id,
					init: {
						type: "CallExpression",
						// @ts-ignore - I am not sure why this is typed wrongly (?)
						arguments: [
							{
								type: "Literal",
								value: pkg,
							},
						],
						callee: {
							type: "Identifier",
							name: "require",
						},
						optional: false,
					},
				},
			],
			kind: "const",
		};

		typeScriptEstree.program.body.unshift(requirePackageAst);
	} else {
		/** @type {import("estree").ImportDeclaration["specifiers"]} */
		const specifiers = [];

		if (default_)
			specifiers.push({
				type: "ImportDefaultSpecifier",
				local: {
					type: "Identifier",
					name: default_,
				},
			});

		for (const [exportedAs, importAs] of Object.entries(named ?? {})) {
			specifiers.push({
				type: "ImportSpecifier",
				imported: {
					type: "Identifier",
					name: exportedAs,
				},
				local: {
					type: "Identifier",
					name: importAs,
				},
			});
		}

		/** @type {import("estree").ImportDeclaration} */
		const importPackageAst = {
			type: "ImportDeclaration",
			source: {
				type: "Literal",
				value: pkg,
			},
			specifiers,
		};

		typeScriptEstree.program.body.unshift(importPackageAst);
	}
};

/**
 * @param {object} param0
 * @param {import("estree").ObjectExpression} param0.configObject
 * @returns {import("estree").ArrayExpression}
 */
export const getPreprocessArray = ({ configObject }) => {
	// Try to find preprocess config
	/** @type {import("estree").Property | undefined} */
	let preprocessConfig;
	for (const property of configObject.properties) {
		if (property.type !== "Property") continue;
		if (property.key.type !== "Identifier") continue;
		if (property.key.name !== "preprocess") continue;

		preprocessConfig = property;
	}
	// Or set it to an empty array if it doesn't exist
	if (!preprocessConfig) {
		preprocessConfig = {
			type: "Property",
			computed: false,
			key: {
				type: "Identifier",
				name: "preprocess",
			},
			kind: "init",
			method: false,
			shorthand: false,
			value: {
				type: "ArrayExpression",
				elements: [],
			},
		};
		configObject.properties.push(preprocessConfig);
	}

	if (preprocessConfig.value.type !== "ArrayExpression") {
		if (preprocessConfig.value.type !== "CallExpression") throw new TypeError("preprocess settings were expected to be a function call");
		// Convert preprocess config from a single function call to an array e.x. [svelte-preprocess()]
		/** @type {import("estree").ArrayExpression} */
		const preprocessArray = {
			type: "ArrayExpression",
			elements: [preprocessConfig.value],
		};
		preprocessConfig.value = preprocessArray;
	}

	return preprocessConfig.value;
};

/**
 *
 * @param {object} param0
 * @param {import("estree").ArrayExpression} param0.preprocessArray
 * @param {string} param0.sveltePreprocessImportedAs
 * @returns {import("estree").ObjectExpression}
 */
export const getSveltePreprocessArgs = ({ preprocessArray, sveltePreprocessImportedAs }) => {
	/** @type {import("estree").CallExpression | undefined} */
	let sveltePreprocessFunctionCall;
	for (const element of preprocessArray.elements) {
		if (!element) continue;
		if (element.type !== "CallExpression") continue;
		if (element.callee.type !== "Identifier") continue;
		if (element.callee.name !== sveltePreprocessImportedAs) continue;
		sveltePreprocessFunctionCall = element;
	}

	// Add a svelte-preprocess() call to the config if missing
	if (!sveltePreprocessFunctionCall) {
		sveltePreprocessFunctionCall = {
			type: "CallExpression",
			// @ts-ignore - I am not sure why this is typed wrongly (?)
			arguments: [],
			callee: {
				type: "Identifier",
				name: sveltePreprocessImportedAs,
			},
			optional: false,
		};

		preprocessArray.elements.push(sveltePreprocessFunctionCall);
	}

	// Initialize the svelte-preprocess options as {} if none were passed
	if (sveltePreprocessFunctionCall.arguments.length === 0) {
		/** @type {import("estree").ObjectExpression} */
		const emptyObject = {
			type: "ObjectExpression",
			properties: [],
		};

		sveltePreprocessFunctionCall.arguments.push(emptyObject);
	}

	if (sveltePreprocessFunctionCall.arguments[0].type !== "ObjectExpression") throw new TypeError("that's an unexpected argument to svelte-preprocess");

	return sveltePreprocessFunctionCall.arguments[0];
};
