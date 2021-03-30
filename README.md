[Mirrored from our internal VCS @ commit hash b7c389ab4ff53bf5e8db8dc0fb80ccd5292eae59]
# Solidity-Raise-Contracts

**Secure Capital Raise Smart Contracts**

Built on a solid foundation of community-vetted code, utilizing [OpenZeppelin industry standards](https://github.com/OpenZeppelin/openzeppelin-contracts).

 * Capital raise with [role-based permissioning](https://gitlab.com/sygnum/blockchain-engineering/ethereum/solidity-base-contracts/contracts/role) integration scheme.
 * Comes with a [RaiseFactory](contracts/factory/RaiseFactory.sol) useful to deploy and configure both the [Raise](contracts/raise/Raise.sol) and its direct interface, the [SygnumTokenProxy](contracts/factory/SygnumProxy.sol), useful for  upgradability features and conceived with the modern [OpenZeppelin standards](https://docs.openzeppelin.com/upgrades/2.7/proxies).
 * [Raise](contracts/raise/Raise.sol) contract serving as the interface to manage the token offering as well as being an escrow account for funds sent by investors.
 * Capital raise implementation with a [maximum and minimum offering amount](contracts/raise/CappedRaise.sol).
 * [Time](contracts/raise/TimedRaise.sol) enforcement defining an opening and closing time.
 * On-chain subscriptions management, offering the issuer possibility to accept or decline subscriptions
 * Audited by [Quantstamp](https://quantstamp.com/) with no major findings.

[![coverage report](https://gitlab.com/sygnum/blockchain-engineering/ethereum/solidity-base-contracts/badges/master/coverage.svg)](https://gitlab.com/sygnum/blockchain-engineering/ethereum/solidity-base-contracts/-/commits/master)

## Overview

The Sygnum Capital Raise is a series of smart contracts that enable a fully on-chain managed fundraising process. The contracts have been designed in a way such that token offerings can be conducted in a transparent and autonomous fashion. With its integrated role-based model it is convenient to use for fundraising services in a regulated environment, for example by making sure that only registered addresses can invest in the offering. The Sygnum Capital Raise can be used to raise funds both through a traditional capital raise process (e.g. capital increase of a company) or for an issuance of other securities (e.g. bonds, ownership tokens reflecting arts & collectibles, etc.).

The [RaiseFactory](contracts/factory/RaiseFactory.sol) is initialized with an ERC20 contract to be used as the payment currency (in Sygnum's case DCHF, although any other ERC20 can be used to raise funds in), role contracts (base, raise), a proxy admin address and a raise implementation contract.

The [RaiseFactory](contracts/factory/RaiseFactory.sol) can be used to initiate a new token offering by [deploying](contracts/libraries/ProxyDeployer.sol) a Raise Proxy.

### Functions

An overview of the most important functions of the [RaiseFactory](contracts/factory/RaiseFactory.sol) and the [Raise](contracts/raise/Raise.sol) can be found below.

#### Raise Factory
`newRaiseProposal`: propose a new capital raise. Can only be called by Issuer.

`operatorProposal`: approve or decline an Issuer's raise proposal. Can only be called by Operator. If accepted, this function triggers the [deployment](contracts/libraries/ProxyDeployer.sol) a new Raise Proxy serving as the escrow account for the offering. Values that can be defined are a minimum and maximum offering amount (i.e. soft and hard cap), an issuance price, an opening and closing time as well as the contract address of the security token which is being offered.

`updateImplementation`: allows to update the raise implementation used for a token offering. This brings flexibility for adapting  to future developments and easily add new features without the need to deploy a new [RaiseFactory](contracts/factory/RaiseFactory.sol).

`updateProxyAdmin`: update the proxy admin used when deploying the Raise Proxy contract. Can only be called by Proxy Admin.

#### Raise
`subscribe`: subscribe a specific amount of tokens. The total investment in DCHF (or any other ERC20 chosen for the raise) is sent from the Investor's address to the raise contract serving as the escrow account. Can only be called by Investor.

`issuerSubscription`: accept or decline a subscription. If declined the funds are sent back to the Investor's address. Can only be called by Issuer.

`issuerClose`: cancel or close the capital raise after either the maximum offering amount has been reached or the closing time has passed. Can only be called by Issuer. No further subscriptions can now be placed, declined or accepted anymore. After this function has been called, a confirmation for the funds held in the escrow can be issued to the Issuer.

`operatorFinalize`: finalize the capital raise after the issuer has closed it, or cancel it (possible at any time). Can only be called by Operator. This function would be called after all necessary regulatory actions have been taken off-chain (e.g. confirmation by the notary, commercial register, etc.).

`releaseToIssuer`: pay out the funds raised during the capital raise to the Issuer's address. Can only be called by Operator or System.

`releaseAllFunds`: pay back all pending and accepted subscriptions to the Investors' addresses. Can only be called by Operator or System. This function would be called after either the Issuer or Operator have cancelled the capital raise.


### Installation

Note: for now this repo only works with NodeJS 10.

Obtain a [gitlab access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html). Using the `api` scope should suffice.

```console
# Set URL for your scoped packages.
# For example package with name `@sygnum/solidity-raise-contracts` will use this URL for download
npm config set @sygnum:registry https://gitlab.com/api/v4/packages/npm/

# Add the token for the scoped packages URL. This will allow you to download
# `@sygnum/` packages from private projects.
npm config set '//gitlab.com/api/v4/packages/npm/:_authToken' "<your_access_token>"
```

Now you are able to install and use all private npm packages within the @sygnum gitlab org. 
```console
npm i --save-dev @sygnum/solidity-raise-contracts
```

### Usage

Once installed, you can use the contracts in the library by importing them:

```solidity
pragma solidity 0.5.12;

import "@sygnum/solidity-raise-contracts/contracts/factory/RaiseFactory.sol";

contract MyContract is RaiseFactory {
    constructor() public {
    }
}
```

To keep your system secure, you should **always** use the installed code as-is, and neither copy-paste it from online sources, nor modify it yourself. The library is designed so that only the contracts and functions you use are deployed, so you don't need to worry about it needlessly increasing gas costs.

### Testing

First, install all required packages:  
`npm install`  

Then run:
`npm test`

## Security

This project is maintained by [Sygnum](https://www.sygnum.com/), and developed following our high standards for code quality and security. We take no responsibility for your implementation decisions and any security problems you might experience.

The latest audit was done on November 2020 at commit hash 1f910f4b.

Please report any security issues you find to team3301@sygnum.com.

## Solidity UML

Solidity UML diagrams can be found in the artifacts associated with the latest successful execution of the "solidity-uml" job in the pipeline.


## Audit Info
This is the root repo that is inherited by all the other repositories, and includes contracts that are used across multiple different repos. By following this pattern, we ensure that we do not unecessarily re-write and re-test contracts throughout the repos.

#### Folders to include
[contracts/factory/*](contracts/factory/)
[contracts/libraries/*](contracts/libraries/)
[contracts/raise/*](contracts/raise/)  

#### Folders/Files to exclude
[contracts/mocks/*](contracts/mocks/) 
[contracts/libraries/Bytes32Set.sol](contracts/libraries/Bytes32Set.sol)
