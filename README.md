# href-checker

Hyperlink checker for HTML pages which checks href attributes by visiting linked pages. Also checks existence of URL fragments.

## Features

- Check validity of links on same page (fragments).
- Check validity of links on same-site or external sites (including fragments).
- Available as a CLI as well as a library.
- Show output as plain text or structured JSON.

## Usage (CLI)

```bash
$ npm install -g href-checker
$ href-checker https://example.com

# or, with npx
$ npx href-checker https://example.com

# See available options and examples
$ href-checker --help
```

### Pro Tip:

This package relies on [puppeteer](https://github.com/puppeteer/puppeteer). If you already have Chromium installed (e.g. own your computer, or CI like GitHub Actions), you can avoid installing another copy of Chromium by setting following two environment variables (before installation and as well as usage):

```bash
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
# Replace the path above with your actual Chromium browser path. Some common values might be:
# on MacOS: "/Applications/Google Chrome.app/Contents/MacOS/Google chrome"
# on Ubuntu: /usr/bin/google-chrome
# on Windows 10: C:\Users\USER\AppData\Local\Google\Chrome\Application\chome.exe
```

## Usage (as library)

```bash
npm install href-checker
```

```js
const { checkLinks } = require("href-checker");

for await (const result of checkLinks(url, options)) {
	console.log(result.type);
	// -> "samePage", "sameSite", "offSite"

	console.log(result.input);
	// -> {
	//     "link": string,           // URL of page being visited.
	//     "count": number,          // Number of occurences of URL.
	// }

	console.log(result.output);
	// -> {
	//     "pageExists": boolean,   // Page resolved with HTTP 20* code.
	//     "status": number,        // HTTP status code.
	//     "fragExists": boolean,   // Element corresponding to fragment exists.
	//     "error": Error,          // Error, if any.
	// }
}
```

See available [options](https://github.com/sidvishnoi/href-checker/blob/main/index.ts).

TypeScript declarations are included in the package.

## Usage (GitHub Action)

Following is an example how to use this tool in a GitHub Action:

```yaml
jobs:
  name: Validate Hyperlinks
  runs-on: ubuntu-latest
  steps:
    - run: npx href-checker https://example.com
      env:
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 1
        PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome
```
