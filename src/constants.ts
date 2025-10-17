export interface Token {
    address: string;
    symbol: string;
    decimals: number;
  }
  
  export const USDC_TOKEN: Token = {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  }
  
  export const WETH_TOKEN: Token = {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    decimals: 18,
  }
  
  export const TOKENS_ADDRESSES = [USDC_TOKEN.address, WETH_TOKEN.address];