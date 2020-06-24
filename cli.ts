#!/usr/bin/env node
import { checkLinks } from "./index.js";

const typeHeading = {
	"same-page": "Fragment links on same page",
	"same-site": "Links to same site",
	"off-site": "Links to external sites",
};

async function main() {
	const url = new URL(process.argv[2]);
	console.log(`Navigating to ${url} ...`);
	let lastType;
	for await (const result of checkLinks(url)) {
		if (result.type !== lastType) {
			lastType = result.type;
			const heading = `${typeHeading[result.type]}:`;
			console.log();
			console.log(heading);
			console.log("-".repeat(heading.length));
		}
		const output = formatOutput(result);
		console.log(output);
	}
}

main().catch(error => {
	console.error(error.message);
	process.exit(1);
});

function formatOutput(result: any) {
	let output;
	if (result.error) {
		output = `🚨`;
	} else {
		if (!result.page) {
			output = "❌";
		} else if (typeof result.fragment === "boolean") {
			output = result.fragment ? "✅" : "🚧";
		} else {
			output = "✅";
		}
	}

	output += `\t${result.link} [x${result.count}]`;
	if (result.error) {
		output += ` (${result.error})`;
	}
	return output;
}
