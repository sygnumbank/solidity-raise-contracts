const TruffleContract = require("@truffle/contract");
const raiseFactoryJson = require("./build/contracts/RaiseFactory.json");
const proxyDeployerJson = require("./build/contracts/ProxyDeployer.json");
const raiseDeployerJson = require("./build/contracts/RaiseDeployer.json");
const raiseJson = require("./build/contracts/Raise.json");
const cappedRaiseJson = require("./build/contracts/CappedRaise.json");
const timedRaiseJson = require("./build/contracts/TimedRaise.json");

module.exports = {
  load: (provider) => {
    const contracts = {
      RaiseDeployer: TruffleContract(raiseDeployerJson),
      RaiseFactory: TruffleContract(raiseFactoryJson),
      ProxyDeployer: TruffleContract(proxyDeployerJson),
      Raise: TruffleContract(raiseJson),
      CappedRaise: TruffleContract(cappedRaiseJson),
      TimedRaise: TruffleContract(timedRaiseJson),
    };
    Object.values(contracts).forEach((i) => i.setProvider(provider));
    return contracts;
  },
};
