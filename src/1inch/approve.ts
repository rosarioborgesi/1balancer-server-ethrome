import { createPublicClient, createWalletClient, Hex, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config";
import { computeAddress } from "ethers";
import { getTokenAddress } from "../utils.ts";

const walletAddress = computeAddress(config.privateKey);


const DEV_PORTAL_API_TOKEN = config.devPortalApiToken;
const PRIVATE_KEY = config.privateKey as `0x${string}`;
const NODE_URL = config.nodeUrl;

const baseUrl = `https://api.1inch.com/swap/v6.1/${base.id}`;

const publicClient = createPublicClient({
    chain: base,
    transport: http(NODE_URL),
});

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(NODE_URL),
});

type ApproveTransactionResponse = {
    to: Hex;
    data: Hex;
    value: bigint;
    gasPrice: string;
};

type AllowanceResponse = { allowance: string };
type TransactionPayload = { to: Hex; data: Hex; value: bigint };

function buildQueryURL(path: string, params: Record<string, string>): string {
    const url = new URL(baseUrl + path);
    url.search = new URLSearchParams(params).toString();
    return url.toString();
}

async function call1inchAPI<T>(
    endpointPath: string,
    queryParams: Record<string, string>,
): Promise<T> {
    const url = buildQueryURL(endpointPath, queryParams);

    console.log(new Date().toISOString(), 'Calling API: ', url);

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${DEV_PORTAL_API_TOKEN}`,
        },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`1inch API returned status ${response.status}: ${body}`);
    }

    return (await response.json()) as T;
}

async function signAndSendTransaction(tx: TransactionPayload): Promise<string> {
    const nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: "pending",
    });

    console.log("Nonce:", nonce.toString());

    try {
        return await walletClient.sendTransaction({
            account,
            to: tx.to,
            data: tx.data,
            value: BigInt(tx.value),
            chain: base,
            nonce,
            kzg: undefined,
        });
    } catch (err) {
        console.error("Transaction signing or broadcasting failed");
        console.error("Transaction data:", tx);
        console.error("Nonce:", nonce.toString());
        throw err;
    }
}


async function checkAllowance(tokenAddress: string): Promise<bigint> {
    console.log("Checking token allowance...");

    const allowanceRes = await call1inchAPI<AllowanceResponse>(
        "/approve/allowance",
        {
            tokenAddress: tokenAddress,
            walletAddress,
        },
    );

    const allowance = BigInt(allowanceRes.allowance);
    console.log("Allowance:", allowance.toString());

    return allowance;
}

export async function approve(token: "WETH" | "USDC", amount: string): Promise<void> {
    const tokenAddress = getTokenAddress(token);
    const requiredAmount = BigInt(amount);
    const allowance = await checkAllowance(tokenAddress);

    if (allowance >= requiredAmount) {
        console.log("Allowance is sufficient for the swap.");
        return;
    }

    console.log("Insufficient allowance. Creating approval transaction...");

    const approveTx = await call1inchAPI<ApproveTransactionResponse>(
        "/approve/transaction",
        {
            tokenAddress,
            amount,
        },
    );

    //console.log("Approval transaction details:", approveTx);

    const txHash = await signAndSendTransaction({
        to: approveTx.to,
        data: approveTx.data,
        value: approveTx.value,
    });

    console.log("Approval transaction sent. Hash:", txHash);
    console.log("Waiting 10 seconds for confirmation...");
    await new Promise((res) => setTimeout(res, 10000));
}

//checkAllowance();
//approveIfNeeded(AMOUNT.toString());