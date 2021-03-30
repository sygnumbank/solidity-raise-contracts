const Raise = artifacts.require("Raise");
const SygnumProxy = artifacts.require("SygnumProxy");

const { BASE_OPERATORS_CONTRACT_ADDRESS, DCHF_CONTRACT_ADDRESS, RAISE_OPERATORS_CONTRACT_ADDRESS, TOKEN_ISSUER, PROXY_ADMIN } = require("../config/deployment");

module.exports = async (deployer, network) => {
  // DEPLOY RAISE
  await deployer.deploy(Raise);

  const raise = await Raise.deployed();

  // INITIALIZE
  await raise.initialize(
    DCHF_CONTRACT_ADDRESS,
    TOKEN_ISSUER,
    1,
    10,
    1,
    1,
    5364666001,
    5396288401,
    BASE_OPERATORS_CONTRACT_ADDRESS,
    RAISE_OPERATORS_CONTRACT_ADDRESS
  );

  // DEPLOY SYGNUM PROXY so that it will be verified on Etherscan
  if (network != "development" && network != "soliditycoverage") {
    await deployer.deploy(SygnumProxy);

    const sygnumProxy = await SygnumProxy.deployed();
  }
};
