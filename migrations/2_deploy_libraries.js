const ProxyDeployer = artifacts.require("ProxyDeployer");
const RaiseDeployer = artifacts.require("RaiseDeployer");
const RaiseFactory = artifacts.require("RaiseFactory");

module.exports = async (deployer) => {
  // DEPLOY LIBRARIES
  const proxyDeployer = await deployer.deploy(ProxyDeployer);
  const raiseDeployer = await deployer.deploy(RaiseDeployer);
  // LINK LIBRARIES
  await deployer.link(ProxyDeployer, RaiseFactory);
  await deployer.link(RaiseDeployer, RaiseFactory);
};
