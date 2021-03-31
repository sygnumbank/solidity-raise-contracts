const { BN, constants, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
const { encodeCall } = require("zos-lib");
const { assertRevert, expectThrow, getAdmin, getImplementation, getTxEvents, getSubId, processSubscription } = require("./tools");

const { ZERO_ADDRESS } = constants;

/* factory */
const RaiseFactory = artifacts.require("RaiseFactory");
const ProxyDeployer = artifacts.require("ProxyDeployer");
const RaiseDeployer = artifacts.require("RaiseDeployer");
const SygnumProxy = artifacts.require("SygnumProxy");

/* mocks */
const CappedRaiseMock = artifacts.require("CappedRaiseMock");
const TimedRaiseMock = artifacts.require("TimedRaiseMock");
const DeployRaiseMock = artifacts.require("DeployRaiseMock");

/* raise */
const Raise = artifacts.require("Raise");
const CappedRaise = artifacts.require("CappedRaise");
const TimedRaise = artifacts.require("TimedRaise");

/* role */
const NAME = "sygnum";
const SYMBOL = "syg";
const DECIMALS = 18;
const CATEGORY = "0x74657374";
const CLASS_TOKEN = "A";

const ONE_ETHER = web3.utils.toWei("1", "ether");
const TWO_ADDRESSES = ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb49", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb42"];

module.exports = {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
  ZERO_ADDRESS,
  TWO_ADDRESSES,
  assertRevert,
  expectThrow,
  getAdmin,
  getImplementation,
  getTxEvents,
  getSubId,
  processSubscription,
  encodeCall,
  Raise,
  CappedRaise,
  TimedRaise,
  RaiseFactory,
  ProxyDeployer,
  RaiseDeployer,
  DeployRaiseMock,
  SygnumProxy,
  CappedRaiseMock,
  TimedRaiseMock,
  NAME,
  SYMBOL,
  DECIMALS,
  CATEGORY,
  CLASS_TOKEN,
  ONE_ETHER,
};
