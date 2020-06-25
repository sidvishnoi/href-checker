#!/usr/bin/env node
import { checkLinks, Entry } from "./index.js";

const typeHeading = {
	samePage: "Same page links (fragments)",
	sameSite: "Same site links",
	offSite: "External links",
};

function newErrorSummary() {
	return {
		invalidPage: [] as Entry["input"][],
		invalidFragment: [] as Entry["input"][],
		error: [] as Entry["input"][],
	};
}

async function main() {
	const url = new URL(process.argv[2]);
	console.log(`Navigating to ${url} ...`);

	const errorSummary = {
		samePage: newErrorSummary(),
		sameSite: newErrorSummary(),
		offSite: newErrorSummary(),
	};

	let lastType: undefined | keyof typeof typeHeading;
	for await (const result of checkLinks(url)) {
		if (result.type !== lastType) {
			lastType = result.type;
			printHeading(lastType);
		}

		const type = getResultType(result);
		if (type !== ResultType.ok) {
			errorSummary[lastType][type].push(result.input);
		}

		const output = formatOutput(result);
		console.log(output);
	}

	printErrorSummary(errorSummary);
	printErrorSummaryTable(errorSummary);
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

type ErrorSummaries = Record<string, ReturnType<typeof newErrorSummary>>;

function printErrorSummary(summaries: ErrorSummaries) {
	for (const [linkType, summary] of Object.entries(summaries)) {
		if (!Object.values(summary).some(a => a.length > 0)) continue;
		console.group(linkType);
		for (const [errorType, inputs] of Object.entries(summary)) {
			if (!inputs.length) continue;
			console.group(errorType);
			for (const { link, count } of inputs) {
				console.log(`${link} [x${count}]`);
			}
			console.groupEnd();
		}
		console.groupEnd();
	}
}

function printErrorSummaryTable(summaries: ErrorSummaries) {
	const linkTypes = Object.keys(summaries);
	const table: any[][] = [["\\", ...linkTypes]];
	for (const [errorType, summary] of Object.entries(summaries)) {
		const values = Object.values(summary).map(a => a.length);
		table.push([errorType, ...values]);
	}
	console.log(table.map(rows => rows.join(" \t| ")).join("\n"));
}

function formatOutput(result: Entry) {
	const { input, output } = result;
	const resultType = getResultType(result);
	let text = getResultEmoji(resultType);
	text += `\t${input.link} [x${input.count}]`;
	if (output.error) {
		text += ` (${output.error})`;
	}
	return text;
}

const enum ResultType {
	ok = "ok",
	invalidPage = "invalidPage",
	invalidFragment = "invalidFragment",
	error = "error",
}

function getResultType(result: Entry) {
	const { error, pageExists, fragExists } = result.output;
	if (error) return ResultType.error;
	if (!pageExists) return ResultType.invalidPage;
	if (typeof fragExists !== "boolean") return ResultType.ok;
	return fragExists ? ResultType.ok : ResultType.invalidFragment;
}

function getResultEmoji(resultType: ReturnType<typeof getResultType>) {
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
