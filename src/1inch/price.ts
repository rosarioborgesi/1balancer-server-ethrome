import axios from "axios";
import { config } from "../config";

const DEV_PORTAL_API_TOKEN = config.devPortalApiToken;

export type TokenPricesMap = Record<string, string>; // address -> price (USD)

/* Example response:

  {
  '0x4200000000000000000000000000000000000006': '3991.8479516',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': '0.999999999998044'
}

*/

export async function callTokenPriceInUsd(tokensAddresses: string[]): Promise<TokenPricesMap> {
  const url =
    `https://api.1inch.com/price/v1.1/8453/${tokensAddresses.join(',')}`;

  const config = {
    headers: {
      Authorization: DEV_PORTAL_API_TOKEN,
    },
    params: {
      currency: "USD",
    },
    paramsSerializer: {
      indexes: null,
    },
  };

  console.log(new Date().toISOString(), 'Calling API: ', url);

  try {
    const response = await axios.get(url, config);
    //console.log("Data", response.data);
    return response.data;
  } catch (error) {
    console.error(error);
    return {};
  }
}

//callTokenPriceInUsd(WETH_BASE_ADDRESS);