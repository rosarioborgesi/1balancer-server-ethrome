import express, { Request, Response } from "express";
import { config } from "./config";
import { computeAddress } from "ethers";
import { callPortfolioTokensSnapshot } from "./1inch/portfolio";
import { swap } from "./1inch/swap";
import { USDC_TOKEN, WETH_TOKEN } from "./constants";
import { callTokenPriceInUsd } from "./1inch/price";
import Decimal from "decimal.js";
import { approve } from "./1inch/approve";

const walletAddress = computeAddress(config.privateKey);

const app = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Balancing server is running')
})

app.listen(config.port, () => {

  console.log(`${new Date().toISOString()} Server listening on port ${config.port}`);
  console.log(`Rebalancing interval: ${config.rebalancingInterval} ms`);
  console.log(`Wallet address: ${walletAddress}`);

  setInterval(async () => {
    console.log(`${new Date().toISOString()} Starting process`);
    await rebalance();
    console.log(`${new Date().toISOString()} Ending process`);
  }, config.rebalancingInterval)
})

async function rebalance() {
  const portfolio = await callPortfolioTokensSnapshot();
  //console.log(portfolio);

  const wethToken = portfolio.find((token) => token.contract_address.toLowerCase() === WETH_TOKEN.address.toLowerCase());

  const usdcToken = portfolio.find((token) => token.contract_address.toLowerCase() === USDC_TOKEN.address.toLowerCase());

  const wethBalance = Decimal(wethToken?.value_usd ?? 0);
  const usdcBalance = Decimal(usdcToken?.value_usd ?? 0);

  console.log(`WETH Balance: ${wethBalance} USD`);
  console.log(`USDC Balance: ${usdcBalance} USD`);

  const totalBalance = wethBalance.plus(usdcBalance);

  console.log(`Total Balance: ${totalBalance} USD`);

  const halfBalance = totalBalance.div(2);

  console.log(`Half Balance: ${halfBalance} USD`);

  const tokenPrices = await callTokenPriceInUsd([WETH_TOKEN.address, USDC_TOKEN.address]);

  const offset = config.offset; // 0.01 -> 1%
  const offsetAmount = halfBalance.mul(offset);
  console.log(`Offset Amount: ${offsetAmount} USD`);
  const halfBalancePlusOffset = halfBalance.plus(offsetAmount);
  console.log(`Half Balance With Offset: ${halfBalancePlusOffset} USD`);

  // WETH > USDC
  if (wethBalance.gt(halfBalancePlusOffset)) {

    console.log(`Swapping WETH to USDC`);

    const wethToSwapInUsd = wethBalance.minus(halfBalance);

    const wethPrice = Decimal(tokenPrices[WETH_TOKEN.address.toLowerCase()]);

    console.log(`WETH Price: ${wethPrice} USD`);

    const wethToSwapEther = wethToSwapInUsd.div(wethPrice);

    console.log(`WETH To Swap (Ether): ${wethToSwapEther}`);

    const wethToSwapWei = wethToSwapEther.mul(10 ** WETH_TOKEN.decimals).toDecimalPlaces(0, Decimal.ROUND_FLOOR);

    console.log(`WETH To Swap (Wei): ${wethToSwapWei.toString()}`);

    await approve("WETH", wethToSwapWei.toString());

    await swap("WETH", "USDC", wethToSwapWei.toString());
  }
  // USDC > WETH
  else if (usdcBalance.gt(halfBalancePlusOffset)) {

    console.log(`Swapping USDC to WETH`);

    const usdcToSwapInUsd = usdcBalance.minus(halfBalance);

    const usdcPrice = Decimal(tokenPrices[USDC_TOKEN.address.toLowerCase()]);

    console.log(`USDC Price: ${usdcPrice} USD`);

    const usdcToSwapEther = usdcToSwapInUsd.div(usdcPrice);

    console.log(`USDC To Swap (Ether): ${usdcToSwapEther}`);

    const usdcToSwapWei = usdcToSwapEther.mul(10 ** USDC_TOKEN.decimals).toDecimalPlaces(0, Decimal.ROUND_FLOOR);

    console.log(`USDC To Swap (Wei): ${usdcToSwapWei.toString()}`);

    await approve("USDC", usdcToSwapWei.toString());

    await swap("USDC", "WETH", usdcToSwapWei.toString());
  }
  else {
    console.log(`No need to swap`);
  }
}