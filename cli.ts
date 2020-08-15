#!/usr/bin/env node
import { checkLinks, Entry } from "./index.js";

const typeHeading = {
	samePage: "Same page links (fragments)",
	sameSite: "Same site links",
	offSite: "External links",
};

async function main() {
	const url = new URL(process.argv[2]);
	console.log(`Navigating to ${url} ...`);
	let lastType: undefined | keyof typeof typeHeading;
	for await (const result of checkLinks(url)) {
		if (result.type !== lastType) {
			lastType = result.type;
			printHeading(lastType);
		}
		const output = formatOutput(result, { emoji: true });
		console.log(output);
	}
}

main().catch(error => {
	console.error(error.message);
	process.exit(1);
});

function printHeading(type: keyof typeof typeHeading) {
	const heading = `${typeHeading[type]}:`;
	console.log();
	console.log(heading);
	console.log("-".repeat(heading.length));
}

function formatOutput(result: Entry, options: { emoji: boolean }) {
	const { input, output } = result;
	const resultType = getResultType(result);
	let text = options.emoji
		? getResultEmoji(resultType)
		: getResultText(resultType);
	text += `\t${input.link} [x${input.count}]`;
	if (output.error) {
		text += ` (${output.error})`;
	}
	return text;
}

const enum ResultType {
	ok,
	invalidPage,
	invalidFragment,
	error,
}

function getResultType(result: Entry): ResultType {
	const { error, pageExists, fragExists } = result.output;
	if (error) return ResultType.error;
	if (!pageExists) return ResultType.invalidPage;
	if (typeof fragExists !== "boolean") return ResultType.ok;
	return fragExists ? ResultType.ok : ResultType.invalidFragment;
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

function getResultText(resultType: ResultType) {
	switch (resultType) {
		case ResultType.ok:
			return "ok";
		case ResultType.invalidPage:
			return "fail";
		case ResultType.invalidFragment:
			return "warn";
		case ResultType.error:
			return "err";
	}
}
