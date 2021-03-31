const RaiseFactory = artifacts.require("RaiseFactory");
const Raise = artifacts.require("Raise");
const { BASE_OPERATORS_CONTRACT_ADDRESS, DCHF_CONTRACT_ADDRESS, RAISE_OPERATORS_CONTRACT_ADDRESS, PROXY_ADMIN } = require("../config/deployment");

module.exports = async (deployer) => {
  // DEPLOY TOKEN FACTORY
  await deployer.deploy(RaiseFactory);

  const raiseFactory = await RaiseFactory.deployed();
  const raise = await Raise.deployed();
  const raiseAddress = raise.address;
  // INITIALIZE
  await raiseFactory.initialize(DCHF_CONTRACT_ADDRESS, BASE_OPERATORS_CONTRACT_ADDRESS, RAISE_OPERATORS_CONTRACT_ADDRESS, PROXY_ADMIN, raiseAddress);
};
