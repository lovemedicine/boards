# boards

A tool for automating retrieval of an organization's board of directors.

## Instructions

1. Install dependencies:

```
npm install
```

2. Copy `.env.default` to `.env` and add your OpenAI API key, Google Search API key, and Google Search API engine ID.

3. Run the script:

```
node index.js --name Walmart --orgdomain
```

The `--orgdomain` flag limits the search to the company's main website. Using this flag could cause the script to miss the company's board of directors page if it's on a different domain (e.g. `aboutamazon.com`).
