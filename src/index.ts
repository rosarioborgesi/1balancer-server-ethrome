import { approve } from "./1inch/approve";
import { callPortfolioTokensSnapshot } from "./1inch/portfolio";
import { callTokenPriceInUsd } from "./1inch/price";
import { WETH_TOKEN } from "./constants";

async function main() {
    /* const portfolioTokens = await callPortfolioTokensSnapshot();
    console.log(portfolioTokens); */
    /* const tokenPrices = await callTokenPriceInUsd([WETH_TOKEN.address]);
    console.log(tokenPrices); */

    approve("WETH", "60000000000000");
}

main();

