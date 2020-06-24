#!/usr/bin/env node
import { checkLinks } from "./index.js";

const typeHeading = {
	"same-page": "Same page links (fragments)",
	"same-site": "Same site links",
	"off-site": "External links",
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
	const resultType = getResultType(result);
	let output = getResultEmoji(resultType);
	output += `\t${result.link} [x${result.count}]`;
	if (result.error) {
		output += ` (${result.error})`;
	}
	return output;
}

const enum ResultType {
	ok,
	invalidPage,
	invalidFragment,
	error,
}

function getResultType(result: any): ResultType {
	if (result.error) return ResultType.error;
	if (!result.page) return ResultType.invalidPage;
	if (typeof result.fragment !== "boolean") return ResultType.ok;
	return result.fragment ? ResultType.ok : ResultType.invalidFragment;
}

function getResultEmoji(resultType: ResultType) {
	switch (resultType) {
		case ResultType.ok:
			return "✅";
		case ResultType.invalidPage:
			return "❌";
		case ResultType.invalidFragment:
			return "🚧";
		case ResultType.error:
			return "🚨";
	}
}
