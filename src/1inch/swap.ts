import { FusionSDK, NetworkEnum, OrderInfo, OrderStatus, PrivateKeyProviderConnector, Web3Like, } from "@1inch/fusion-sdk";
import { computeAddress, JsonRpcProvider } from "ethers";
import { config } from "../config";
import { getAxiosErrorMessage, getTokenAddress } from "../utils";

const PRIVATE_KEY = config.privateKey;
const NODE_URL = config.nodeUrl;
const DEV_PORTAL_API_TOKEN = config.devPortalApiToken;

//const AMOUNT = 60000000000000;

const ethersRpcProvider = new JsonRpcProvider(NODE_URL)

const ethersProviderConnector: Web3Like = {
    eth: {
        call(transactionConfig): Promise<string> {
            return ethersRpcProvider.call(transactionConfig)
        }
    },
    extend(): void { }
}

const connector = new PrivateKeyProviderConnector(
    PRIVATE_KEY,
    ethersProviderConnector
)

const sdk = new FusionSDK({
    url: 'https://api.1inch.com/fusion',
    network: NetworkEnum.COINBASE,
    blockchainProvider: connector,
    authKey: DEV_PORTAL_API_TOKEN
})

// Swap WETH - USDC
export async function swap(fromToken: "WETH" | "USDC", toToken: "WETH" | "USDC", amountWei: string) {
    console.log(new Date().toISOString(), 'Calling API: ', 'https://api.1inch.com/fusion');
    const fromTokenAddress = getTokenAddress(fromToken);
    const toTokenAddress = getTokenAddress(toToken);

    const params = {
        fromTokenAddress,
        toTokenAddress,
        amount: amountWei,
        walletAddress: computeAddress(PRIVATE_KEY),
        source: 'sdk-test'
    }

    console.log(`Swapping ${fromTokenAddress} to ${toTokenAddress} amount ${amountWei} wei`);

    const quote = await sdk.getQuote(params);

    console.log("getQuote completed");

    if (!quote || !quote.presets || !quote.recommendedPreset) {
        throw new Error("No quote found");
    }

    /* const dstTokenDecimals = 18;
    console.log('Auction start amount', formatUnits(quote.presets[quote.recommendedPreset].auctionStartAmount, dstTokenDecimals));
    console.log('Auction end amount', formatUnits(quote.presets[quote.recommendedPreset].auctionEndAmount), dstTokenDecimals); */

    const preparedOrder = await sdk.createOrder(params);

    console.log('createOrder completed');

    const info = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId);

    console.log('submitOrder completed');

    const start = Date.now();

    // Retry loop with 30-second delays
    while (true) {
        const isComplete = await checkOrderStatus(info);
        if (isComplete) {
            break;
        }

        console.log('Order still pending, waiting 30 seconds before next check...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }

    console.log('Order executed for', (Date.now() - start) / 1000, 'sec');
}

// Retry mechanism with 30-second intervals
const checkOrderStatus = async (info: OrderInfo): Promise<boolean> => {
    try {
        const data = await sdk.getOrderStatus(info.orderHash);

        if (data.status === OrderStatus.Filled) {
            //console.log('fills', data.fills);
            console.log("Order Filled with tx hash: ", data.fills[0].txHash);
            return true; 
        }

        if (data.status === OrderStatus.Expired) {
            console.log('Order Expired');
            return true;
        }

        if (data.status === OrderStatus.Cancelled) {
            console.log('Order Cancelled');
            return true;
        }

        return false;
    } catch (e) {
        console.log(getAxiosErrorMessage(e));
        return false;
    }
};