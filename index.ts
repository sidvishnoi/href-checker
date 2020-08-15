import puppeteer, { Browser, Page } from "puppeteer";

export interface Options {
	/** Check existence of fragment links on same page. */
	samePage: boolean;
	/** Check links on same origin. */
	sameSite: boolean;
	/** Check external site links. */
	offSite: boolean;
	/** Check existence of fragment links outside the current page. */
	fragments: boolean;
	puppeteer: {
		timeout: puppeteer.DirectNavigationOptions["timeout"];
		waitUntil: puppeteer.DirectNavigationOptions["waitUntil"];
	};
}

const defaults: Options = {
	samePage: true,
	sameSite: true,
	offSite: true,
	fragments: true,
	puppeteer: {
		timeout: 20_000,
		waitUntil: "load",
	},
};

export interface Entry {
	input: { link: string; count: number };
	output: Partial<{ pageExists: boolean; fragExists: boolean; error: Error }>;
	type: "samePage" | "sameSite" | "offSite";
}

export async function* checkLinks(
	url: URL,
	options: Partial<Options> = {},
): AsyncGenerator<Entry, void, void> {
	const opts = { ...defaults, ...options };
	opts.puppeteer = { ...defaults.puppeteer, ...options.puppeteer };

	let caughtError;

	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		const response = await page.goto(url.href, opts.puppeteer);
		if (!response || !response.ok()) {
			const reason = response ? `. HTTP ${response.status()}` : "";
			throw new Error(`Failed to navigate to ${url}${reason}`);
		}

		const links = await getAllLinks(page, opts);
		for await (const res of checkSamePageLinks(links.samePage, page)) {
			yield { ...res, type: "samePage" };
		}
		for await (const res of checkOffPageLinks(links.sameSite, browser, opts)) {
			yield { ...res, type: "sameSite" };
		}
		for await (const res of checkOffPageLinks(links.offSite, browser, opts)) {
			yield { ...res, type: "offSite" };
		}
	} catch (error) {
		caughtError = error;
	} finally {
		await browser.close();
		if (caughtError) throw caughtError;
	}
}

export async function getAllLinks(page: Page, options: Options) {
	return {
		samePage: count(options.samePage ? await getSamePageLinks(page) : []),
		sameSite: count(options.sameSite ? await getSameSiteLinks(page) : []),
		offSite: count(options.offSite ? await getExternalLinks(page) : []),
	};
}

function getExternalLinks(page: Page) {
	return page.$$eval("a[href]", elems => {
		return (elems as HTMLAnchorElement[])
			.filter(a => /https?:/.test(a.protocol) && a.origin !== location.origin)
			.map(a => a.href);
	});
}

function getSameSiteLinks(page: Page) {
	return page.$$eval("a[href]:not([href^='#'])", elems => {
		return (elems as HTMLAnchorElement[])
			.filter(a => a.origin === location.origin)
			.map(a => a.href);
	});
}

function getSamePageLinks(page: Page) {
	return page.$$eval("a[href^='#']", elems => {
		return (elems as HTMLAnchorElement[]).map(a => a.hash);
	});
}

async function* checkSamePageLinks(links: Map<string, number>, page: Page) {
	for (const [link, count] of links) {
		if (link.length <= 1) continue;
		const fragExists = await isFragmentValid(link, page);
		yield { input: { link, count }, output: { pageExists: true, fragExists } };
	}
}

async function* checkOffPageLinks(
	links: Map<string, number>,
	browser: Browser,
	options: Options,
) {
	const uniqueLinks = [...links.keys()];
	// TODO: limit concurrency
	// TODO: retry on TimeoutError
	const resultPromises = uniqueLinks.map(link =>
		isLinkValid(link, options, browser),
	);
	for (let i = 0; i < uniqueLinks.length; i++) {
		const link = uniqueLinks[i];
		const result = await resultPromises[i];
		yield { input: { link, count: links.get(link)! }, output: result };
	}
}

async function isFragmentValid(hash: string, page: Page) {
	const id = hash.replace(/^#/, "");
	const selector = `[id='${id}'], [name='${id}']`;
	try {
		return page.$eval(selector, el => !!el);
	} catch {
		return false;
	}
}

async function isLinkValid(
	link: string,
	options: Options,
	browser: Browser,
): Promise<{ error: Error } | { pageExists: boolean; fragExists?: boolean }> {
	const url = new URL(link);
	const page = await browser.newPage();
	try {
		const response = await page.goto(link, options.puppeteer);
		const pageExists = !response || response.ok();
		let fragExists;
		if (options.fragments && pageExists && url.hash && url.hash.length > 1) {
			fragExists = await isFragmentValid(url.hash, page);
		}
		return { pageExists, fragExists };
	} catch (error) {
		return { error };
	} finally {
		await page.close();
	}
}

function count<T>(items: T[]) {
	const counts = new Map<T, number>();
	for (const item of items) {
		const count = counts.get(item) || 0;
		counts.set(item, count + 1);
	}
	return counts;
}
