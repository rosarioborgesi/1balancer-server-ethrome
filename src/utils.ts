import { USDC_TOKEN, WETH_TOKEN } from "./constants";

export function getTokenAddress(token: "WETH" | "USDC"): string {
    if (token === "WETH") {
        return WETH_TOKEN.address;
    }
    return USDC_TOKEN.address;
}