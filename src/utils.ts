import { USDC_TOKEN, WETH_TOKEN } from "./constants";
import { AxiosError } from "axios";

export function getTokenAddress(token: "WETH" | "USDC"): string {
    if (token === "WETH") {
        return WETH_TOKEN.address;
    }
    return USDC_TOKEN.address;
}

export function getAxiosErrorMessage(error: unknown) {
    const e = error as AxiosError;
    if (e.response?.data) {
      return typeof e.response.data === "string"
        ? e.response.data
        : JSON.stringify(e.response.data);
    }
    return e.message ?? String(error);
  }