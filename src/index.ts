import express, { Request, Response } from "express";
import { config } from "./config";
import { computeAddress } from "ethers";
import { callPortfolioTokensSnapshot } from "./1inch/portfolio";
import { swap } from "./1inch/swap";
import { USDC_TOKEN, WETH_TOKEN } from "./constants";
import { callTokenPriceInUsd } from "./1inch/price";
import Decimal from "decimal.js";
import { approve } from "./1inch/approve";
import fs from "node:fs/promises";
import { IExecDataProtectorDeserializer } from "@iexec/dataprotector-deserializer";

const walletAddress = computeAddress(config.privateKey);

// iExec batch mode function
async function runIexecBatch() {
  const IEXEC_OUT = process.env.IEXEC_OUT;
  if (!IEXEC_OUT) return null;
  
  let computedJsonObj = {};
  let userPrivateKey: string | null = null;
  
  try {
    console.log("Running in iExec mode - deserializing protected data");
    
    const deserializer = new IExecDataProtectorDeserializer();
    // The protected data contains the user's private key
    userPrivateKey = await deserializer.getValue('private-key', 'string');
    
    if (!userPrivateKey) {
      throw new Error('Failed to retrieve private key from protected data');
    }
    
    console.log('Successfully retrieved protected private key');
    
    // Perform rebalancing with the user's private key
    await rebalance(userPrivateKey);
    
    // Write result to IEXEC_OUT
    await fs.writeFile(`${IEXEC_OUT}/result.txt`, `Rebalancing completed at ${new Date().toISOString()}`);
    
    computedJsonObj = {
      'deterministic-output-path': `${IEXEC_OUT}/result.txt`,
    };
  } catch (e) {
    console.log('Error in iExec batch mode:', e);
    computedJsonObj = {
      'deterministic-output-path': IEXEC_OUT,
      'error-message': 'Rebalancing failed: ' + (e instanceof Error ? e.message : String(e)),
    };
  } finally {
    // Save the "computed.json" file
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  }
  
  return userPrivateKey;
}

// Express server mode
function startExpressServer() {
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
      await rebalance(config.privateKey);
      console.log(`${new Date().toISOString()} Ending process`);
    }, config.rebalancingInterval)
  })
}

async function rebalance(privateKey: string) {
  const userWalletAddress = computeAddress(privateKey);
  console.log(`Rebalancing for wallet: ${userWalletAddress}`);
  
  const portfolio = await callPortfolioTokensSnapshot(userWalletAddress);
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

    await approve("WETH", wethToSwapWei.toString(), privateKey);

    await swap("WETH", "USDC", wethToSwapWei.toString(), privateKey);
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

    await approve("USDC", usdcToSwapWei.toString(), privateKey);

    await swap("USDC", "WETH", usdcToSwapWei.toString(), privateKey);
  }
  else {
    console.log(`No need to swap`);
  }
}

// Main entry point - decide between iExec mode or Express server mode
async function main() {
  if (process.env.IEXEC_OUT) {
    console.log("Running in iExec batch mode");
    await runIexecBatch();
  } else {
    console.log("Running in Express server mode");
    startExpressServer();
  }
}

main().catch(console.error);