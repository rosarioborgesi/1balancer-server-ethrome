import express, { Request, Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { computeAddress, Wallet, JsonRpcProvider } from "ethers";
import { callPortfolioTokensSnapshot } from "./1inch/portfolio.js";
import { swap } from "./1inch/swap.js";
import { USDC_TOKEN, WETH_TOKEN } from "./constants.js";
import { callTokenPriceInUsd } from "./1inch/price.js";
import Decimal from "decimal.js";
import { approve } from "./1inch/approve.js";
import fs from "node:fs/promises";
import { IExecDataProtectorDeserializer } from "@iexec/dataprotector-deserializer";
import { IExec } from "iexec";

const walletAddress = computeAddress(config.privateKey);

// Strategy storage
interface Strategy {
  userId: string;
  protectedDataAddress: string;
  walletAddress: string;
  createdAt: number;
  lastTriggered?: number;
  activeDealId?: string;
  lastDealStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const strategies = new Map<string, Strategy>();

// Track active deals to prevent duplicates
const activeDeals = new Set<string>();

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

// Trigger iExec worker for a strategy
async function triggerIExecRebalance(strategy: Strategy): Promise<void> {
  try {
    if (!config.iexecAppAddress) {
      console.error('IEXEC_APP_ADDRESS not configured, skipping iExec trigger');
      return;
    }

    // Check if there's already an active deal for this user
    if (activeDeals.has(strategy.userId)) {
      console.log(`⏭️  Skipping user ${strategy.userId} - deal already in progress`);
      return;
    }

    // Throttle: don't trigger more than once every 2 minutes per user
    const now = Date.now();
    const minInterval = 2 * 60 * 1000; // 2 minutes
    if (strategy.lastTriggered && (now - strategy.lastTriggered) < minInterval) {
      console.log(`⏭️  Skipping user ${strategy.userId} - triggered ${Math.floor((now - strategy.lastTriggered) / 1000)}s ago`);
      return;
    }

    console.log(`Triggering iExec worker for user ${strategy.userId}`);
    console.log(`Protected data address: ${strategy.protectedDataAddress}`);

    // Mark as active
    activeDeals.add(strategy.userId);
    strategy.lastTriggered = now;
    strategy.lastDealStatus = 'pending';

    // Initialize ethers wallet and provider
    const provider = new JsonRpcProvider(config.iexecRpcUrl);
    const wallet = new Wallet(config.privateKey, provider);
    
    const iexec = new IExec(
      {
        ethProvider: wallet,
      }
    );

    // Verify protected data exists and is accessible
    try {
      const dataset = await iexec.dataset.showDataset(strategy.protectedDataAddress);
      console.log(`✅ Protected data verified: ${dataset.objAddress}`);
    } catch (verifyError) {
      console.error(`❌ Protected data not found or not accessible: ${strategy.protectedDataAddress}`);
      throw new Error(`Protected data validation failed: ${verifyError}`);
    }

    // Create app order
    const apporder = await iexec.order.createApporder({
      app: config.iexecAppAddress,
      appprice: 0,
      volume: 1,
    });
    const signedApporder = await iexec.order.signApporder(apporder);

    // Create dataset order (protected data)
    const datasetorder = await iexec.order.createDatasetorder({
      dataset: strategy.protectedDataAddress,
      datasetprice: 0,
      volume: 1,
    });
    const signedDatasetorder = await iexec.order.signDatasetorder(datasetorder);

    // Create workerpool order
    const workerpoolorder = await iexec.order.createWorkerpoolorder({
      workerpool: config.iexecWorkerpoolAddress,
      workerpoolprice: 0,
      volume: 1,
      category: 0,
    });
    const signedWorkerpoolorder = await iexec.order.signWorkerpoolorder(workerpoolorder);

    // Create request order
    const requestorder = await iexec.order.createRequestorder({
      app: config.iexecAppAddress,
      appmaxprice: 0,
      dataset: strategy.protectedDataAddress,
      datasetmaxprice: 0,
      workerpool: config.iexecWorkerpoolAddress,
      workerpoolmaxprice: 0,
      requester: walletAddress,
      volume: 1,
      category: 0,
      params: {
        iexec_result_storage_provider: 'ipfs',
        iexec_result_storage_proxy: 'https://result-proxy.bellecour.iex.ec',
      },
    });
    const signedRequestorder = await iexec.order.signRequestorder(requestorder);

    // Match orders to create deal
    const { dealid, txHash } = await iexec.order.matchOrders({
      apporder: signedApporder,
      datasetorder: signedDatasetorder,
      workerpoolorder: signedWorkerpoolorder,
      requestorder: signedRequestorder,
    });

    console.log(`✅ iExec deal created for user ${strategy.userId}`);
    console.log(`Deal ID: ${dealid}`);
    console.log(`Transaction: ${txHash}`);

    // Update strategy with deal info
    strategy.activeDealId = dealid;
    strategy.lastDealStatus = 'running';

    // Remove from active deals after 10 minutes (task should complete by then)
    setTimeout(() => {
      activeDeals.delete(strategy.userId);
      console.log(`⏰ Deal timeout - removing ${strategy.userId} from active deals`);
    }, 10 * 60 * 1000); // 10 minutes

  } catch (error) {
    console.error(`❌ Failed to trigger iExec for user ${strategy.userId}:`, error);
    // Remove from active deals on error
    activeDeals.delete(strategy.userId);
    strategy.lastDealStatus = 'failed';
  }
}

// Express server mode with strategy management
function startExpressServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (req: Request, res: Response) => {
    res.json({ 
      status: 'running',
      timestamp: new Date().toISOString(),
      strategies: strategies.size,
      activeDeals: activeDeals.size,
      iexecConfigured: !!config.iexecAppAddress
    });
  })

  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      healthy: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  })

  // Endpoint to receive strategy with protected data address
  app.post('/strategy', (req: Request, res: Response): void => {
    const { userId, protectedDataAddress, walletAddress: userWalletAddress } = req.body;
    
    if (!userId || !protectedDataAddress || !userWalletAddress) {
      res.status(400).json({ 
        error: 'Missing required fields: userId, protectedDataAddress, walletAddress' 
      });
      return;
    }

    const strategy: Strategy = {
      userId,
      protectedDataAddress,
      walletAddress: userWalletAddress,
      createdAt: Date.now(),
    };

    strategies.set(userId, strategy);
    console.log(`✅ Strategy stored for user ${userId}`);
    console.log(`Protected data: ${protectedDataAddress}`);
    console.log(`Wallet: ${userWalletAddress}`);

    res.json({ 
      success: true, 
      message: 'Strategy stored successfully',
      strategy 
    });
  });

  // Endpoint to get all strategies
  app.get('/strategies', (req: Request, res: Response) => {
    const allStrategies = Array.from(strategies.values());
    res.json({ strategies: allStrategies });
  });

  // Endpoint to manually trigger rebalancing for a user
  app.post('/trigger/:userId', async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const strategy = strategies.get(userId);

    if (!strategy) {
      res.status(404).json({ error: `No strategy found for user ${userId}` });
      return;
    }

    await triggerIExecRebalance(strategy);
    res.json({ success: true, message: 'iExec rebalancing triggered' });
  });

  app.listen(config.port, () => {
    console.log(`${new Date().toISOString()} Server listening on port ${config.port}`);
    console.log(`Rebalancing interval: ${config.rebalancingInterval} ms`);
    console.log(`Server wallet address: ${walletAddress}`);
    console.log(`iExec app address: ${config.iexecAppAddress || 'NOT CONFIGURED'}`);

    // Cron job to check and trigger rebalancing for all strategies
    setInterval(async () => {
      try {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} Checking strategies for rebalancing...`);
        
        const allStrategies = Array.from(strategies.values());
        
        if (allStrategies.length === 0) {
          console.log('No strategies to process');
          return;
        }

        console.log(`Found ${allStrategies.length} strategy(ies) to process`);
        console.log(`Active deals: ${activeDeals.size}`);
        
        for (const strategy of allStrategies) {
          try {
            await triggerIExecRebalance(strategy);
          } catch (strategyError) {
            console.error(`Error processing strategy for ${strategy.userId}:`, strategyError);
            // Continue with next strategy even if one fails
          }
        }
        
        console.log(`${new Date().toISOString()} Completed rebalancing check`);
      } catch (cronError) {
        console.error('Critical error in cron job:', cronError);
        // Don't crash the server, just log and continue
      }
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