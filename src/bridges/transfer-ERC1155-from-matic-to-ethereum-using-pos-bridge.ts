import { MaticPOSClient } from "@maticnetwork/maticjs";
import HDWalletProvider from "@truffle/hdwallet-provider";
import Web3 from "web3";
import BN from "bn.js";
import { eventTracking } from "../utils";
import {
  DEFAULT_GAS_PRICE,
  DEFAULT_MATIC_VERSION,
  DEFAULT_MATIC_NETWORK,
} from "../consts";

export interface TransferERC1155FromMaticToEthereumUsingPOSBridge {
  polygonMumbaiApiUrl: string;
  polygonAccountPrivateKey: string;
  accountPrivateKey: string;
  ethereumHttpsApiUrl: string;
  ethereumWebsocktesApiUrl: string;
  childTokenAddress: string;
  recipientAddress: string;
  amounts: (string | BN)[];
  tokenIds: (string | BN)[];
  rootChainProxyAddress?: string;
  maticNetwork?: string;
  maticVersion?: string;
  gasPrice?: string;
}

export async function transferERC1155FromMaticToEthereumUsingPOSBridge({
  polygonMumbaiApiUrl,
  accountPrivateKey,
  ethereumHttpsApiUrl,
  ethereumWebsocktesApiUrl,
  childTokenAddress,
  amounts,
  tokenIds,
  recipientAddress,
  // RootChainProxy Address on root chain (0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287 for mainnet)
  rootChainProxyAddress = "0x2890ba17efe978480615e330ecb65333b880928e",
  maticNetwork = DEFAULT_MATIC_NETWORK,
  maticVersion = DEFAULT_MATIC_VERSION,
  gasPrice = DEFAULT_GAS_PRICE,
}: TransferERC1155FromMaticToEthereumUsingPOSBridge) {
  // https://github.com/trufflesuite/truffle-hdwallet-provider
  // set the shareNonce to false so maticProvider and parentProvider won't share nonce which causes errors
  const maticProvider = new HDWalletProvider(
    accountPrivateKey,
    polygonMumbaiApiUrl,
    0,
    1,
    false
  );

  const parentProvider = new HDWalletProvider(
    accountPrivateKey,
    ethereumHttpsApiUrl,
    0,
    1,
    false
  );

  const maticPOSClient = new MaticPOSClient({
    network: maticNetwork,
    version: maticVersion,
    parentProvider,
    maticProvider,
  });

  const from = maticProvider.getAddress();

  const isSingle = tokenIds.length === 1 && amounts.length === 1;

  const burnOptions = {
    from,
    gasPrice,
    to: recipientAddress,
  };

  const { transactionHash: burnTransationHash } = isSingle
    ? await maticPOSClient.burnSingleERC1155(
        childTokenAddress,
        tokenIds[0],
        amounts[0],
        burnOptions
      )
    : await maticPOSClient.burnBatchERC1155(
        childTokenAddress,
        tokenIds,
        amounts,
        burnOptions
      );

  const parentWebsocketProvider = new Web3.providers.WebsocketProvider(
    ethereumWebsocktesApiUrl
  );

  const parentWebsocketWeb3 = new Web3(parentWebsocketProvider);

  const childWeb3 = new Web3(maticProvider);

  // All transactions that occur on Matic chain are check-pointed to the Ethereum chain in frequent intervals of time by the validators. This time is ~10 mins on Mumbai and ~30 mins on Matic mainnet.
  await eventTracking.checkInclusion({
    txHash: burnTransationHash,
    rootChainAddress: rootChainProxyAddress,
    childWeb3,
    parentWebsocketWeb3,
  });

  parentWebsocketProvider.disconnect(
    0,
    "burn proof event received, connection not needed"
  );

  const exitOptions = {
    from,
    to: recipientAddress,
  };

  const exitERC1155 = isSingle
    ? maticPOSClient.exitSingleERC1155
    : maticPOSClient.exitBatchERC1155;

  await exitERC1155(burnTransationHash, exitOptions);
}
