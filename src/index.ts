import { callPortfolioTokensSnapshot } from "./1inch/portfolio";
import { callTokenPriceInUsd } from "./1inch/price";
import { WETH_TOKEN } from "./constants";

async function main() {
    //onst portfolioTokens = await callPortfolioTokensSnapshot();
    //console.log(portfolioTokens);
    const tokenPrices = await callTokenPriceInUsd([WETH_TOKEN.address]);
    console.log(tokenPrices);
}

main();

