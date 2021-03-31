const { load } = require("@sygnum/solidity-edge-dchf-contracts");
const loadBase = require("@sygnum/solidity-base-contracts").load;
const { RAISE } = require("../config");
const { expectEvent, getTxEvents, DeployRaiseMock, Raise, RaiseDeployer, time, ZERO_ADDRESS } = require("../common");

const { EdgeToken } = load(Raise.currentProvider);
const { BaseOperators, RaiseOperators, Whitelist } = loadBase(Raise.currentProvider);

contract("DeployRaiseMock", ([admin, operator, system, newImplementation, issuer, proxyAdmin, attacker]) => {
  beforeEach(async () => {
    this.baseOperators = await BaseOperators.new(admin, { from: admin });
    this.raiseOperators = await RaiseOperators.new({ from: admin });
    this.whitelist = await Whitelist.new({ from: admin });
    this.dchf = await EdgeToken.new({ from: admin });
    this.equity = await EdgeToken.new({ from: admin });

    this.raiseDeployer = await RaiseDeployer.new({ from: admin });
    await DeployRaiseMock.link("RaiseDeployer", this.raiseDeployer.address);

    this.now = await time.latest();
  });
  describe("initialization", () => {
    beforeEach(async () => {
      this.mock = await DeployRaiseMock.new({ from: admin });
    });
    it("should be deployed", async () => {
      assert.notEqual(this.mock.address, ZERO_ADDRESS);
    });
    describe("deploy raise", () => {
      beforeEach(async () => {
        RAISE.open = this.now.add(time.duration.days(1));
        RAISE.close = RAISE.open.add(time.duration.days(RAISE.duration));
        this.tx = await this.mock.deployAndInitialize(
          this.dchf.address,
          issuer,
          RAISE.min,
          RAISE.max,
          RAISE.price,
          RAISE.minSubscription,
          RAISE.open,
          RAISE.close,
          this.baseOperators.address,
          this.raiseOperators.address
        );
      });
      it("should have emitted events", async () => {
        expectEvent(this.tx, "RaiseDeployed");
      });
      describe("get deployed instance", () => {
        beforeEach(async () => {
          const address = getTxEvents(this.tx, "RaiseDeployed", this.mock.abi)[0].args.raise;
          this.raise = await Raise.at(address);
        });
        it("should have correct dchf", async () => {
          assert.equal(await this.raise.dchf(), this.dchf.address);
        });
        it("should have correct issuer", async () => {
          assert.equal(await this.raise.issuer(), issuer);
        });
        it("should have correct min", async () => {
          assert.equal((await this.raise.getMinCap()).toString(), RAISE.min.toString());
        });
        it("should have correct max", async () => {
          assert.equal((await this.raise.getMaxCap()).toString(), RAISE.max.toString());
        });
        it("should have correct open", async () => {
          assert.equal((await this.raise.getOpening()).toString(), RAISE.open.toString());
        });
        it("should have correct close", async () => {
          assert.equal((await this.raise.getClosing()).toString(), RAISE.close.toString());
        });
        it("should have correct price", async () => {
          assert.equal((await this.raise.price()).toString(), RAISE.price.toString());
        });
        it("should have correct min subscription", async () => {
          assert.equal((await this.raise.minSubscription()).toString(), RAISE.minSubscription.toString());
        });
        it("should have correct baseOperators", async () => {
          assert.equal(await this.raise.getOperatorsContract(), this.baseOperators.address);
        });
        it("should have correct raiseOperators", async () => {
          assert.equal(await this.raise.getRaiseOperatorsContract(), this.raiseOperators.address);
        });
      });
    });
  });
});
