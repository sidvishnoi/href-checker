#!/usr/bin/env node
import sade from "sade";
import { checkLinks, Entry, Options } from "./index.js";
import { readFileSync } from "fs";

import { DirectNavigationOptions } from "puppeteer";

const typeHeading = {
	samePage: "Same page links (fragments)",
	sameSite: "Same site links",
	offSite: "External links",
};

interface CommandLineOptions {
	"same-page": boolean;
	"same-site": boolean;
	"off-site": boolean;
	fragments: boolean;
	timeout: number;
	"wait-until": DirectNavigationOptions["waitUntil"];
	format: "json" | "pretty";
	emoji: boolean;
}

sade("hyperlinkinator <url>", true)
	.version(JSON.parse(readFileSync("./package.json", "utf-8")).version)
	.option("--same-page", "Check same-page (fragment) links", true)
	.option("--same-site", "Check same-site links", true)
	.option("--off-site", "Check external links", true)
	.option(
		"--fragments",
		"Check for existence of IDs corresponding to fragments",
		true,
	)
	.option("--timeout", "Timeout (in seconds) for navigation", 20)
	.option(
		"--wait-until",
		'Wait until either "load", "domcontentloaded", "networkidle0", "networkidle2" events.',
		"load",
	)
	.option("--format", "Format output as pretty or json", "pretty")
	.option("--emoji", "Use emoji in output (with --format=pretty)", true)
	.action(async (url: string, options: CommandLineOptions) => {
		try {
			await main(new URL(url), {
				options: {
					samePage: options["same-page"],
					sameSite: options["same-site"],
					offSite: options["off-site"],
					fragments: options.fragments,
					puppeteer: {
						timeout: options.timeout * 1000,
						waitUntil: options["wait-until"],
					},
				},
				emoji: options["emoji"],
				format: options.format || "pretty",
			});
		} catch (error) {
			console.error(error.message);
			process.exit(1);
		}
	})
	.parse(process.argv);

interface Opts {
	options: Options;
	emoji: boolean;
	format: CommandLineOptions["format"];
}
async function main(url: URL, options: Opts) {
	console.log(`Navigating to ${url} ...`);
	let lastType: undefined | keyof typeof typeHeading;
	for await (const result of checkLinks(url, options.options)) {
		if (result.type !== lastType) {
			lastType = result.type;
			printHeading(lastType);
		}
		const output = formatOutput(result, { emoji: options.emoji });
		console.log(output);
	}
}

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
