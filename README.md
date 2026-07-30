<a href="https://www.usebillsplit.com/">
<img alt="Self" src="./public/og.png">
</a>

<div align="center">
    <h1 >BillSplit</h1>
    <p>
        A modern bill splitting app. Powered by Together.ai.
    </p>
</div>

## Tech Stack

- Next.js 16 with App Router for modern web development
- Together.ai for advanced LLM capabilities
- Braintrust for privacy-safe receipt extraction tracing
- Amazon S3 for secure image storage
- Vercel for seamless deployment and hosting

## How it works

1. User uploads a picture of the bill
2. The app processes the receipt image using Together.ai with a vision model and structured JSON output
3. The app let the user choose how to split items and add people names
4. The app displays the final summary with the split of the bill

## Cloning & running

1. Fork or clone the repo
2. Create an account at https://togetherai.link/?utm_source=billsplit&utm_medium=referral&utm_campaign=example-app for the LLM
3. Create an account at https://aws.amazon.com/ for the S3 bucket
4. Optionally create a Braintrust API key to trace privacy-safe extraction metadata
5. Create a `.env` (use the `.example.env` for reference) and replace the API keys
6. Run `pnpm install` and `pnpm run dev` to install dependencies and run locally
