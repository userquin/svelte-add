export const name = "Firebase Hosting";

/** @typedef {{ project: string }} Options */

/** @type {import("../..").AdderOptions<Options>} */
export const options = {
	project: {
		context: "You can find it at https://console.firebase.google.com/",
		question: "What is your Firebase project's ID?",
		default: "",
	},
};
