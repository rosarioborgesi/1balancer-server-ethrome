import { callPortfolioTokensSnapshot } from "./1inch/portfolio";

async function main() {
    const portfolioTokens = await callPortfolioTokensSnapshot();
    console.log(portfolioTokens);
}

main();

