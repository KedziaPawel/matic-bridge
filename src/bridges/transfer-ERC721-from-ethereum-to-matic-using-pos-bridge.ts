import { MaticPOSClient } from "@maticnetwork/maticjs";
import HDWalletProvider from "@truffle/hdwallet-provider";
import {
  DEFAULT_GAS_PRICE,
  DEFAULT_MATIC_VERSION,
  DEFAULT_MATIC_NETWORK,
} from "../consts";

export interface TransferERC721FromEthereumToMaticUsingPOSBridge {
  maticApiUrl: string;
  ethereumAccountPrivateKey: string;
  ethereumApiUrl: string;
  rootTokenAddress: string;
  recipientAddress: string;
  tokenId: string;
  maticNetwork?: string;
  maticVersion?: string;
  gasPrice?: string;
}

export async function transferERC721FromEthereumToMaticUsingPOSBridge({
  maticApiUrl,
  ethereumAccountPrivateKey,
  ethereumApiUrl,
  rootTokenAddress,
  recipientAddress,
  tokenId,
  maticNetwork = DEFAULT_MATIC_NETWORK,
  maticVersion = DEFAULT_MATIC_VERSION,
  gasPrice = DEFAULT_GAS_PRICE,
}: TransferERC721FromEthereumToMaticUsingPOSBridge) {
  const parentProvider = new HDWalletProvider(
    ethereumAccountPrivateKey,
    ethereumApiUrl
  );

  const maticPOSClient = new MaticPOSClient({
    network: maticNetwork,
    version: maticVersion,
    parentProvider,
    maticProvider: maticApiUrl,
  });

  const from = parentProvider.getAddress();

  await maticPOSClient.approveERC721ForDeposit(rootTokenAddress, tokenId, {
    from,
  });

  await maticPOSClient.depositERC721ForUser(
    rootTokenAddress,
    recipientAddress,
    tokenId,
    {
      from,
      gasPrice,
    }
  );
}
