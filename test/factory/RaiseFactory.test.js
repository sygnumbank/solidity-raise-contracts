const { load } = require("@sygnum/solidity-base-contracts");
const loadEdge = require("@sygnum/solidity-edge-dchf-contracts").load;
const { RAISE } = require("../config");
const { expectRevert, expectEvent, getSubId, SygnumProxy, ProxyDeployer, RaiseFactory, Raise, RaiseDeployer, time, ZERO_ADDRESS } = require("../common");

const { BaseOperators, RaiseOperators, Whitelist } = load(Raise.currentProvider);
const { EdgeToken } = loadEdge(Raise.currentProvider);

contract("RaiseFactory", ([admin, operator, system, newImplementation, issuer, proxyAdmin, attacker]) => {
  beforeEach(async () => {
    this.baseOperators = await BaseOperators.new(admin, { from: admin });
    this.raiseOperators = await RaiseOperators.new({ from: admin });
    this.whitelist = await Whitelist.new({ from: admin });
    this.dchf = await EdgeToken.new({ from: admin });
    this.equity = await EdgeToken.new({ from: admin });

    this.proxyDeployer = await ProxyDeployer.new({ from: admin });
    this.tokenDeployer = await RaiseDeployer.new({ from: admin });
    await RaiseFactory.link("ProxyDeployer", this.proxyDeployer.address);
    await RaiseFactory.link("RaiseDeployer", this.tokenDeployer.address);

    this.factory = await RaiseFactory.new({ from: admin });
    this.implementation = await Raise.new({ from: admin });

    this.now = await time.latest();
    this.RAISE = {
      ...RAISE,
      open: this.now.add(time.duration.days(1)),
      close: this.now.add(time.duration.days(RAISE.duration)),
    };

    await this.baseOperators.addOperator(operator, { from: admin });
    await this.baseOperators.addSystem(system, { from: admin });
  });
  it("operator is set", async () => {
    assert.equal(await this.baseOperators.isOperator(operator), true);
  });
  it("system is set", async () => {
    assert.equal(await this.baseOperators.isSystem(system), true);
  });
  describe("initialize operators contracts", () => {
    beforeEach(async () => {
      await this.whitelist.initialize(this.baseOperators.address, {
        from: admin,
      });
      await this.raiseOperators.initialize(this.baseOperators.address, {
        from: admin,
      });
      await this.dchf.initialize(this.baseOperators.address, this.whitelist.address, { from: admin });
      await this.raiseOperators.addIssuer(issuer, { from: operator });
    });
    it("should have added an issuer", async () => {
      assert.equal(await this.raiseOperators.isIssuer(issuer), true);
    });
    describe("intialize factory", () => {
      beforeEach(async () => {
        await this.factory.initialize(this.dchf.address, this.baseOperators.address, this.raiseOperators.address, proxyAdmin, this.implementation.address);
      });
      it("should be initialized", async () => {
        assert.equal(await this.factory.isInitialized(), true);
      });
      it("should have the baseOperators", async () => {
        assert.equal(await this.factory.getOperatorsContract(), this.baseOperators.address);
      });
      it("should have the raiseOperators", async () => {
        assert.equal(await this.factory.getRaiseOperatorsContract(), this.raiseOperators.address);
      });
      it("should have the proxyAdmin", async () => {
        assert.equal(await this.factory.proxyAdmin(), proxyAdmin);
      });
      it("should have the correct implementation", async () => {
        assert.equal(await this.factory.implementation(), this.implementation.address);
      });
      describe("update implementation", () => {
        beforeEach(async () => {
          this.dchf = await EdgeToken.new({ from: admin });
          this.implementation = await Raise.new({ from: admin });
          await this.factory.updateImplementation(this.implementation.address, { from: operator });
        });
        it("should update the implementation address", async () => {
          assert.equal(await this.factory.implementation(), this.implementation.address);
        });
        it("should revert when called by invalid address", async () => {
          await expectRevert(
            this.factory.updateImplementation(ZERO_ADDRESS, {
              from: attacker,
            }),
            "Operatorable: caller does not have the operator role"
          );
        });
      });
      describe("update proxy admin", () => {
        beforeEach(async () => {
          await this.factory.updateProxyAdmin(operator, { from: proxyAdmin });
        });
        it("should update the proxy admin address", async () => {
          assert.equal(await this.factory.proxyAdmin(), operator);
        });
        it("should revert when called by attacker", async () => {
          await expectRevert(this.factory.updateProxyAdmin(ZERO_ADDRESS, { from: attacker }), "RaiseFactory: caller not proxy admin");
        });
        it("should revert when called by invalid address", async () => {
          await expectRevert(this.factory.updateProxyAdmin(ZERO_ADDRESS, { from: proxyAdmin }), "RaiseFactory: caller not proxy admin");
        });
      });
      describe("new raise proposal", () => {
        beforeEach(async () => {
          this.raiseId = getSubId();
          this.tx = await this.factory.newRaiseProposal(this.raiseId, {
            from: issuer,
          });
        });
        it("should have emitted subscription proposal event", async () => {
          expectEvent(this.tx, "NewProposal");
        });
        it("should have created a proposal correctly", async () => {
          const raise = await this.factory.raise(this.raiseId);
          assert.equal(raise.issuer, issuer);
        });
        it("should have no implementation yet", async () => {
          assert.equal(await this.factory.implementationExists(this.raiseId), false);
        });
        it("should revert when called twice with same id", async () => {
          await expectRevert(this.factory.newRaiseProposal(this.raiseId, { from: issuer }), "RaiseFactory: already exists");
        });
        it("should revert when called by an attacker", async () => {
          await expectRevert(this.factory.newRaiseProposal(getSubId(), { from: attacker }), "RaiseOperatorable: caller is not issuer");
        });
        it("should revert on inexisting proposal", async () => {
          await expectRevert(
            this.factory.operatorProposal(
              getSubId(),
              true,
              this.RAISE.min,
              this.RAISE.max,
              this.RAISE.price,
              this.RAISE.minSubscription,
              this.RAISE.open,
              this.RAISE.close,
              this.equity.address,
              { from: operator }
            ),
            "RaiseFactory: issuer not existing"
          );
        });
        describe("reject proposal", () => {
          beforeEach(async () => {
            this.tx = await this.factory.operatorProposal(
              this.raiseId,
              false,
              this.RAISE.min,
              this.RAISE.max,
              this.RAISE.price,
              this.RAISE.minSubscription,
              this.RAISE.open,
              this.RAISE.close,
              this.equity.address,
              { from: operator }
            );
          });
          it("should have emitted proposal declined event", async () => {
            expectEvent(this.tx, "ProposalDeclined");
          });
          it("should have deleted the placeholder", async () => {
            const raise = await this.factory.raise(this.raiseId);
            assert.equal(raise.issuer, ZERO_ADDRESS);
          });
        });
        describe("approve proposal", () => {
          beforeEach(async () => {
            this.tx = await this.factory.operatorProposal(
              this.raiseId,
              true,
              this.RAISE.min,
              this.RAISE.max,
              this.RAISE.price,
              this.RAISE.minSubscription,
              this.RAISE.open,
              this.RAISE.close,
              this.equity.address,
              { from: operator }
            );
          });
          it("should have emitted proposal acceptance event", async () => {
            expectEvent(this.tx, "ProposalAccepted");
          });
          it("should revert when called twice on already approved", async () => {
            await expectRevert(
              this.factory.operatorProposal(
                this.raiseId,
                true,
                this.RAISE.min,
                this.RAISE.max,
                this.RAISE.price,
                this.RAISE.minSubscription,
                this.RAISE.open,
                this.RAISE.close,
                this.equity.address,
                { from: operator }
              ),
              "RaiseFactory: already exists"
            );
          });
          it("should have an implementation", async () => {
            assert.equal(await this.factory.implementationExists(this.raiseId), true);
          });
          it("should have correct token", async () => {
            assert.equal(await this.factory.getToken(this.raiseId), this.equity.address);
          });
          it("should have correct issuer", async () => {
            assert.equal(await this.factory.getIssuer(this.raiseId), issuer);
          });
          describe("verify proxy deployment", () => {
            beforeEach(async () => {
              const out = await this.factory.getImplementationAndProxy(this.raiseId);
              this.logic = await Raise.at(out[0]);
              this.raise = await Raise.at(out[1]);
              this.proxy = await SygnumProxy.at(out[1]);
            });
            it("should have correct implementation", async () => {
              assert.equal(await this.logic.address, this.implementation.address);
            });
            it("should have initialized proxy", async () => {
              assert.equal(await this.raise.isInitialized(), true);
            });
            it("should have correct min cap", async () => {
              assert.equal((await this.raise.getMinCap()).toString(), this.RAISE.min.toString());
            });
            it("should have correct max cap", async () => {
              assert.equal((await this.raise.getMaxCap()).toString(), this.RAISE.max.toString());
            });
            it("should have correct opening", async () => {
              assert.equal((await this.raise.getOpening()).toString(), this.RAISE.open.toString());
            });
            it("should have correct closing", async () => {
              assert.equal((await this.raise.getClosing()).toString(), this.RAISE.close.toString());
            });
            it("should have correct price", async () => {
              assert.equal((await this.raise.price()).toString(), this.RAISE.price.toString());
            });
            it("should have correct issuer", async () => {
              assert.equal(await this.raise.isIssuer(issuer), true);
            });
            it("should have correct proxyAdmin", async () => {
              assert.exists(await this.proxy.admin({ from: proxyAdmin }));
            });
            it("should have correct raiseOperators", async () => {
              assert.equal(await this.raise.getRaiseOperatorsContract(), this.raiseOperators.address);
            });
            it("should have correct baseOperators", async () => {
              assert.equal(await this.raise.getOperatorsContract(), this.baseOperators.address);
            });
          });
        });
      });
    });
  });
});
