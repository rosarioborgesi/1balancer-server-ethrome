import axios from "axios";
import { config } from "../config.js";
import { computeAddress } from "ethers";

const DEV_PORTAL_API_TOKEN = config.devPortalApiToken;
const walletAddress = computeAddress(config.privateKey);

// Types describing the 1inch Portfolio Tokens Snapshot response
interface PortfolioTokenSnapshotItem {
    index: string;
    chain: number;
    contract_address: string;
    token_id: number;
    address: string;
    block_number_created: number;
    block_number: number | null;
    timestamp: number | null;
    protocol_type: string;
    protocol_handler_id: string;
    protocol_group_id: string;
    protocol_group_name: string;
    protocol_group_icon: string;
    protocol_sub_group_id: string | null;
    protocol_sub_group_name: string | null;
    contract_name: string;
    contract_symbol: string;
    asset_sign: number;
    status: number;
    underlying_tokens: unknown[];
    reward_tokens: unknown[];
    value_usd: number;
    locked: boolean;
}

/* 
Example response: it's an array of objects with each token having these fields:

[
    {
        index: '0x9f600a34199777fd',
        chain: 8453,
        contract_address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        token_id: 0,
        address: '0x0000000000000000000000000000000000000000',
        block_number_created: 0,
        block_number: null,
        timestamp: null,
        protocol_type: 'token',
        protocol_handler_id: 'native',
        protocol_group_id: 'token',
        protocol_group_name: 'Token',
        protocol_group_icon: 'https://app.1inch.io/assets/overview/tokens.svg',
        protocol_sub_group_id: null,
        protocol_sub_group_name: null,
        contract_name: 'Ether',
        contract_symbol: 'ETH',
        asset_sign: 1,
        status: 1,
        underlying_tokens: [Array],
        reward_tokens: [],
        value_usd: 1.172562906833689,
        locked: false
    }
}

*/


interface PortfolioTokensSnapshotResponse {
    result: PortfolioTokenSnapshotItem[];
}

export async function callPortfolioTokensSnapshot(walletAddress: string): Promise<PortfolioTokenSnapshotItem[]> {
    const url = "https://api.1inch.com/portfolio/portfolio/v5.0/tokens/snapshot";

    const config = {
        headers: {
            Authorization: `Bearer ${DEV_PORTAL_API_TOKEN}`,
        },
        params: {
            addresses: [walletAddress],
            chain_id: "8453",
        },
        paramsSerializer: {
            indexes: null,
        },
    };

    console.log(new Date().toISOString(), 'Calling API: ', url);

    try {
        const response = await axios.get<PortfolioTokensSnapshotResponse>(url, config);
        return response.data.result;
    } catch (error) {
        console.error('Error fetching portfolio tokens:', error);
        throw error;
    }
}