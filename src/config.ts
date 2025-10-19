import "dotenv/config";

const required = ['PRIVATE_KEY', 'NODE_URL', 'DEV_PORTAL_API_TOKEN'] as const;
const missing = required.filter((k) => {
    const v = process.env[k];
    return !v || v.trim() === '';
});

if (missing.length) {
    throw new Error(`Missing required environment variables (empty or undefined): ${missing.join(', ')}`);
}

export const config = {
    privateKey: process.env.PRIVATE_KEY!,
    nodeUrl: process.env.NODE_URL!,
    devPortalApiToken: process.env.DEV_PORTAL_API_TOKEN!,
    port: process.env.PORT || 3001, // Changed from 3000 (Next.js default)
    rebalancingInterval: Number(process.env.REBALANCING_INTERVAL) || 60_000, // ms  60_000 ms -> 1 minute
    offset: Number(process.env.OFFSET) || 0.01, // 0.01 -> 1%
    // iExec Configuration
    iexecAppAddress: process.env.IEXEC_APP_ADDRESS || '',
    iexecWorkerpoolAddress: process.env.IEXEC_WORKERPOOL_ADDRESS || 'prod-v8-bellecour.main.pools.iexec.eth',
    iexecRpcUrl: process.env.IEXEC_RPC_URL || 'https://bellecour.iex.ec',
}
