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

export async function* checkLinks(url: URL, options: Partial<Options> = {}) {
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

		if (opts.samePage) {
			const samePageLinks = await getSamePageLinks(page);
			for await (const res of checkSamePageLinks(samePageLinks, page)) {
				yield { ...res, type: "same-page" as const };
			}
		}

		if (opts.sameSite) {
			const sameSiteLinks = await getSameSiteLinks(page);
			for await (const res of checkOffPageLinks(sameSiteLinks, browser, opts)) {
				yield { ...res, type: "same-site" as const };
			}
		}

		if (opts.offSite) {
			const externalLinks = await getExternalLinks(page);
			for await (const res of checkOffPageLinks(externalLinks, browser, opts)) {
				yield { ...res, type: "off-site" as const };
			}
		}
	} catch (error) {
		caughtError = error;
	} finally {
		await browser.close();
		if (caughtError) throw caughtError;
	}
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

async function* checkSamePageLinks(links: string[], page: Page) {
	for (const [link, count] of createCounter(links)) {
		const valid = await page.$eval(`[id=${link.slice(1)}]`, elem => !!elem);
		yield { link, page: true, fragment: valid, count };
	}
}

async function* checkOffPageLinks(
	links: string[],
	browser: Browser,
	options: Options,
) {
	const isValidLink = async (link: string) => {
		const url = new URL(link);
		const page = await browser.newPage();
		try {
			const response = await page.goto(link, options.puppeteer);
			const pageExists = !response || response.ok();
			let fragExists;
			if (pageExists && url.hash && options.fragments) {
				const id = url.hash.slice(1);
				const selector = `[id='${id}'], [name='${id}']`;
				fragExists = await page.$eval(selector, el => !!el).catch(() => false);
			}
			return { page: pageExists, fragment: fragExists };
		} catch (error) {
			return { error: error };
		} finally {
			await page.close();
		}
	};

	const linkCounter = createCounter(links);
	const uniqueLinks = [...linkCounter.keys()];
	// TODO: limit concurrency
	// TODO: retry on TimeoutError
	const resultPromises = uniqueLinks.map(isValidLink);
	for (let i = 0; i < uniqueLinks.length; i++) {
		const link = uniqueLinks[i];
		const result = await resultPromises[i];
		yield { link, ...result, count: linkCounter.get(link)! };
	}
}

function createCounter<T>(items: T[]) {
	const counts = new Map<T, number>();
	for (const item of items) {
		const count = counts.get(item) || 0;
		counts.set(item, count + 1);
	}
	return counts;
}
