#!/usr/bin/env node
import sade from "sade";
import { join } from "path";
import { readFileSync } from "fs";

import { checkLinks } from "./index.js";

import { Entry, Options } from "./index.js";
import { DirectNavigationOptions } from "puppeteer";

interface CommandLineOptions {
	"same-page": false | "err" | "warn";
	"same-site": false | "err" | "warn";
	"off-site": false | "err" | "warn";
	fragments: false | "err" | "warn";
	concurrency: number;
	timeout: number;
	"wait-until": DirectNavigationOptions["waitUntil"];
	format: "json" | "pretty";
	silent: boolean;
	emoji: boolean;
}

const { version } = JSON.parse(
	readFileSync(join(__dirname, "package.json"), "utf-8"),
) as { version: string };

sade("href-checker <url>", true)
	.version(version)
	.example("https://example.com")
	.example("https://sidvishnoi.github.io/ --no-off-site --format=json")
	.example("https://www.w3.org/ --no-same-site --no-same-page --fragments=err")
	.option("--same-page", "Check same-page (fragment) links", "err")
	.option("--same-site", "Check same-site links", "err")
	.option("--off-site", "Check external links", "err")
	.option("--fragments", "Check fragment anchors", "warn")
	.option("--concurrency -c", "How many links to check at a time", 5)
	.option("--timeout", "Timeout (in seconds) for navigation", 20)
	.option(
		"--wait-until",
		'Wait until either "load", "domcontentloaded", "networkidle0", "networkidle2" events.',
		"load",
	)
	.option("--format", "Format output as pretty or json", "pretty")
	.option("--silent", "Show errors only", false)
	.option("--emoji", "Use emoji in output (with --format=pretty)", true)
	.action(async (url: string, options: CommandLineOptions) => {
		try {
			await main(new URL(url), options);
		} catch (error) {
			console.error(error.message);
			process.exit(1);
		}
	})
	.parse(process.argv);

async function main(url: URL, opts: CommandLineOptions) {
	const LinkType = {
		"same-page": "samePage",
		"same-site": "sameSite",
		"off-site": "offSite",
		fragments: "fragments",
	} as const;

	for (const type of Object.keys(LinkType) as Array<keyof typeof LinkType>) {
		if (![false, "err", "warn"].includes(opts[type])) {
			throw new Error(
				`Invalid value ${JSON.stringify(opts[type])} for --${type}.`,
			);
		}
	}

	const options: Options = {
		samePage: opts["same-page"] !== false,
		sameSite: opts["same-site"] !== false,
		offSite: opts["off-site"] !== false,
		fragments: opts.fragments !== false,
		concurrency: opts.concurrency,
		puppeteer: {
			timeout: opts.timeout * 1000,
			waitUntil: opts["wait-until"],
		},
	};

	const errorIf: OutputOptions["errorIf"] = new Set();
	const warnIf: OutputOptions["warnIf"] = new Set();
	for (const type of Object.keys(LinkType) as Array<keyof typeof LinkType>) {
		const linkType = LinkType[type];
		if (opts[type] === "err") {
			errorIf.add(linkType);
		} else if (opts[type] === "warn") {
			warnIf.add(linkType);
		}
	}
	const outputOptions: OutputOptions = {
		silent: opts.silent,
		format: opts.format || "pretty",
		emoji: opts.format === "json" ? false : opts.emoji,
		errorIf,
		warnIf,
	};

	let hasFailures = false;
	for await (const result of checkLinks(url, options)) {
		const resultType = getResultType(result, outputOptions);
		if (resultType === ResultType.fail) hasFailures = true;
		const output = formatOutput(result, resultType, outputOptions);
		if (output) console.log(output);
	}
	if (hasFailures) {
		throw new Error("Broken links found.")
	}
}

interface OutputOptions {
	silent: CommandLineOptions["silent"];
	format: CommandLineOptions["format"];
	emoji: CommandLineOptions["emoji"];
	errorIf: Set<"samePage" | "sameSite" | "offSite" | "fragments">;
	warnIf: Set<"samePage" | "sameSite" | "offSite" | "fragments">;
}

function formatOutput(
	result: Entry,
	resultType: ResultType,
	options: OutputOptions,
) {
	const { input, output } = result;

	if (options.silent && resultType === ResultType.ok) {
		return null;
	}
	const statusSummary = getResultText(resultType, options.emoji);

	if (options.format === "json") {
		// @ts-ignore
		result.output.summary = statusSummary;
		if (result.output.error) {
			const { name, message } = result.output.error;
			result.output.error = { name, message };
		}
		return JSON.stringify(result);
	}

	const statusCode =
		!output.error && !output.pageExists && output.status
			? ` {${output.status}}`
			: "";
	let text = `[${result.type}]\t${statusSummary}\t${input.link} [x${input.count}]${statusCode}`;
	if (output.error) {
		text += ` (${output.error})`;
	}
	return text;
}

const enum ResultType {
	ok,
	fail,
	warn,
	err,
}

function getResultType(result: Entry, options: OutputOptions) {
	const { pageExists, fragExists, error } = result.output;

	if (error) {
		return ResultType.err;
	}

	if (
		(!pageExists && options.errorIf.has(result.type)) ||
		(fragExists === false && options.errorIf.has("fragments"))
	) {
		return ResultType.fail;
	}

	if (
		(!pageExists && options.warnIf.has(result.type)) ||
		(fragExists === false && options.warnIf.has("fragments"))
	) {
		return ResultType.warn;
	}

	return ResultType.ok;
}

function getResultText(resultType: ResultType, emoji: boolean) {
	switch (resultType) {
		case ResultType.ok:
			return emoji ? "✅" : "ok";
		case ResultType.fail:
			return emoji ? "❌" : "fail";
		case ResultType.warn:
			return emoji ? "🚧" : "warn";
		case ResultType.err:
			return emoji ? "🚨" : "err";
	}
}
