# 1Balancer Server - ETH Rome 2025

An automated portfolio rebalancing server built for **ETH Rome 2025** that maintains optimal asset allocation using 1inch APIs and iExec TEE (Trusted Execution Environment) for secure private key handling.

## 🎯 Project Overview

This project demonstrates automated DeFi portfolio management with privacy-preserving execution:
- Frontend encrypts user's private key using iExec DataProtector
- Express server runs continuously, receiving encrypted strategy data
- Server triggers iExec TEE workers to execute rebalancing in secure hardware enclaves
- TEE workers decrypt private keys, execute swaps, all within protected hardware

## 🚀 Features

- **Hybrid Architecture**: Express server + iExec TEE workers
- **Privacy-Preserving**: Private keys never exposed to server, only decrypted in TEE
- **Automated Rebalancing**: Continuously monitors and rebalances WETH/USDC portfolio
- **1inch Integration**: Leverages 1inch Fusion SDK for optimal swap execution
- **Configurable Thresholds**: Adjustable rebalancing triggers and intervals
- **Strategy Management**: RESTful API for receiving and managing user strategies
- **iExec Integration**: Programmatic TEE worker triggering

## 🏗️ Architecture

### Hybrid Express + iExec TEE Architecture

The system operates in two modes simultaneously:

**Express Server (Continuous)**:
- Receives encrypted strategy data from frontend via `/strategy` endpoint
- Stores strategy information (user ID, protected data address, wallet)
- Runs cron job checking strategies at configured intervals
- Triggers iExec TEE workers for secure rebalancing

**iExec TEE Worker (On-Demand)**:
- Triggered by Express server for each strategy
- Runs in Trusted Execution Environment (Intel SGX/AMD SEV)
- Deserializes protected data (decrypts private key within TEE)
- Executes rebalancing logic securely
- Private key never leaves the secure enclave

### Complete Flow

1. **Frontend**: User enters private key → Encrypted with iExec DataProtector → Stored on blockchain
2. **Frontend**: Grants server wallet access to encrypted data via blockchain ACL
3. **Frontend**: Sends protected data address to Express server
4. **Express Server**: Stores strategy in memory
5. **Cron Job**: Periodically checks all strategies
6. **Express Server**: Triggers iExec worker with protected data address
7. **iExec**: Creates deal, matches orders, starts TEE execution
8. **TEE Worker**: Decrypts private key, analyzes portfolio, executes swaps
9. **Result**: Portfolio rebalanced, private key never exposed

## 📋 Prerequisites

- Node.js (v18+)
- pnpm package manager
- Ethereum wallet with private key
- 1inch Developer Portal API token
- RPC endpoint (Coinbase Base network)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd 1balancer-server-ethrome
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env` file with the following variables:
   ```env
   PRIVATE_KEY=your_wallet_private_key
   NODE_URL=your_rpc_endpoint
   DEV_PORTAL_API_TOKEN=your_1inch_api_token
   PORT=3000
   REBALANCING_INTERVAL=60000
   OFFSET=0.01
   ```

## 🚀 Usage

### Development
```bash
pnpm dev
```

### Production
```bash
pnpm build
pnpm start
```

### Watch Mode
```bash
pnpm watch
```

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Wallet private key for transactions | Required |
| `NODE_URL` | Ethereum RPC endpoint | Required |
| `DEV_PORTAL_API_TOKEN` | 1inch API token | Required |
| `PORT` | Server port | 3000 |
| `REBALANCING_INTERVAL` | Rebalancing check interval (ms) | 60000 |
| `OFFSET` | Rebalancing threshold (0.01 = 1%) | 0.01 |

## 🔄 How It Works

1. **Portfolio Monitoring**: Server checks portfolio every minute (configurable)
2. **Balance Calculation**: Computes USD values of WETH and USDC holdings
3. **Deviation Detection**: Identifies when allocation exceeds 50% ± threshold
4. **Swap Execution**: Automatically executes swaps to restore balance
5. **Order Tracking**: Monitors swap completion with retry logic

## 📊 API Endpoints

- `GET /` - Health check and server status

## 🛡️ Security Considerations

- Store private keys securely using environment variables
- Use dedicated wallets for automated trading
- Monitor gas fees and transaction costs
- Implement proper error handling and logging

## 🧪 Testing

```bash
# Type checking
pnpm check

# Build verification
pnpm build
```

## 📦 Dependencies

- **@1inch/fusion-sdk**: 1inch Fusion API integration
- **ethers**: Ethereum interaction library
- **express**: Web server framework
- **decimal.js**: Precise decimal arithmetic
- **axios**: HTTP client for API calls

## 🎓 ETH Rome 2025

This project was developed for **ETH Rome 2025**, showcasing practical DeFi automation and portfolio management techniques. It demonstrates real-world applications of:

- Automated trading strategies
- DEX integration
- Portfolio optimization
- Smart contract interactions

## 📝 License

ISC License

## 🤝 Contributing

This project is part of ETH Rome 2025. For contributions or questions, please reach out to the development team.

---

**Built for ETH Rome 2025** 🏛️
