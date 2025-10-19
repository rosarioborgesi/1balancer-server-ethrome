export interface Token {
    address: string;
    symbol: string;
    decimals: number;
  }
  
  export const USDC_TOKEN: Token = {
    address: "0x75faf114eafb1BDEaC50eF6582f0F6C74d2A361c", // USDC on Arbitrum Sepolia
    symbol: "USDC",
    decimals: 6,
  }
  
  export const WETH_TOKEN: Token = {
    address: "0xE591bf4550f521D88537AbC3B2519d39bFFb62a0", // WETH on Arbitrum Sepolia
    symbol: "WETH",
    decimals: 18,
  }
  
  export const TOKENS_ADDRESSES = [USDC_TOKEN.address, WETH_TOKEN.address];