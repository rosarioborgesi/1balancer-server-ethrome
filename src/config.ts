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
    port: process.env.PORT || 3000,
    rebalancingInterval: Number(process.env.REBALANCING_INTERVAL) || 60_000, // ms  60_000 ms -> 1 minute
    offset: Number(process.env.OFFSET) || 0.01, // 0.01 -> 1%
}
