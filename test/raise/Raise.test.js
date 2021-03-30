const { load } = require("@sygnum/solidity-edge-dchf-contracts");
const loadBase = require("@sygnum/solidity-base-contracts").load;
const { RAISE } = require("../config");

const { expectRevert, expectEvent, getSubId, processSubscription, time, Raise, BN, ZERO_ADDRESS } = require("../common");

const { EdgeToken } = load(Raise.currentProvider);
const { BaseOperators, RaiseOperators, Whitelist } = loadBase(Raise.currentProvider);

contract("Raise", ([admin, issuer, operator, system, investor1, investor2, investor3, investor4, notWhitelisted, attacker]) => {
  beforeEach(async () => {
    this.now = await time.latest();
    this.baseOperators = await BaseOperators.new(admin, { from: admin });
    await this.baseOperators.addOperator(operator, { from: admin });
    this.raiseOperators = await RaiseOperators.new({ from: admin });
    this.dchf = await EdgeToken.new({ from: admin });
    this.whitelist = await Whitelist.new({ from: admin });
    this.raise = await Raise.new({ from: admin });
    this.RAISE = {
      ...RAISE,
      open: this.now.add(time.duration.days(1)),
      close: this.now.add(time.duration.days(RAISE.duration)),
    };
    this.RAISE.minShares = this.RAISE.minSubscription.div(this.RAISE.price);
    this.SHARES = {
      [investor1]: [],
      [investor2]: [],
      [investor3]: [],
      [investor4]: [],
    };
  });
  context("contract initialization", () => {
    describe("operator contracts", () => {
      beforeEach(async () => {
        await this.whitelist.initialize(this.baseOperators.address, { from: admin });
        await this.raiseOperators.initialize(this.baseOperators.address, { from: admin });
        await this.dchf.initialize(this.baseOperators.address, this.whitelist.address, { from: admin });
      });
      it("should fail on init with zero min cap", async () => {
        const initFn = this.raise.initialize(
          this.dchf.address,
          issuer,
          new BN(0),
          this.RAISE.max,
          this.RAISE.price,
          this.RAISE.minSubscription,
          this.RAISE.open,
          this.RAISE.close,
          this.baseOperators.address,
          this.raiseOperators.address
        );
        await expectRevert(initFn, "CappedRaise: minimum cap must exceed zero");
      });
      it("should fail on init with max cap lower than min", async () => {
        const initFn = this.raise.initialize(
          this.dchf.address,
          issuer,
          this.RAISE.min,
          this.RAISE.min.sub(new BN(1)),
          this.RAISE.price,
          this.RAISE.minSubscription,
          this.RAISE.open,
          this.RAISE.close,
          this.baseOperators.address,
          this.raiseOperators.address
        );
        await expectRevert(initFn, "CappedRaise: maximum cap must exceed minimum cap");
      });
      it("should fail on init with open in the past", async () => {
        const initFn = this.raise.initialize(
          this.dchf.address,
          issuer,
          this.RAISE.min,
          this.RAISE.max,
          this.RAISE.price,
          this.RAISE.minSubscription,
          this.now.sub(time.duration.days(1)),
          this.RAISE.close,
          this.baseOperators.address,
          this.raiseOperators.address
        );
        await expectRevert(initFn, "TimedRaise: opening time is before current time");
      });
      it("should fail on init with closing before opening", async () => {
        const initFn = this.raise.initialize(
          this.dchf.address,
          issuer,
          this.RAISE.min,
          this.RAISE.max,
          this.RAISE.price,
          this.RAISE.minSubscription,
          this.RAISE.open,
          this.RAISE.open.sub(time.duration.days(1)),
          this.baseOperators.address,
          this.raiseOperators.address
        );
        await expectRevert(initFn, "TimedRaise: opening time is not before closing time");
      });
      describe("init raise", () => {
        beforeEach(async () => {
          await this.raise.initialize(
            this.dchf.address,
            issuer,
            this.RAISE.min,
            this.RAISE.max,
            this.RAISE.price,
            this.RAISE.minSubscription,
            this.RAISE.open,
            this.RAISE.close,
            this.baseOperators.address,
            this.raiseOperators.address
          );
        });
        it("should be initialized correctly", async () => {
          assert.equal(await this.raise.dchf(), this.dchf.address, "DCHF address not set correctly");
          assert.equal((await this.raise.getMinCap()).toString(), this.RAISE.min.toString(), "max cap not set correctly");
          assert.equal((await this.raise.getMaxCap()).toString(), this.RAISE.max.toString(), "min cap not set correctly");
          assert.equal((await this.raise.getOpening()).toString(), this.RAISE.open.toString(), "opening not set correctly");
          assert.equal((await this.raise.getClosing()).toString(), this.RAISE.close.toString(), "closing not set correctly");
        });

        describe("check raise status", () => {
          it("should have correct time status", async () => {
            assert.equal(await this.raise.isOpen(), false, "it has not correct open status");
            assert.equal(await this.raise.hasClosed(), false, "it has not correct closed status");
          });
          it("should have correct share status", async () => {
            assert.equal((await this.raise.getSold()).toString(), "0", "it has not correct sold shares");
            assert.equal((await this.raise.getReceiversLength()).toString(), "0", "it has not correct receivers");
            assert.equal((await this.raise.getAvailableShares()).toString(), this.RAISE.max.toString(), "it has not correct available shares");
            assert.equal(await this.raise.minCapReached(), false, "it has not correct cap reach");
            assert.equal(await this.raise.maxCapReached(), false, "it has not correct cap reach");
          });
        });

        describe("pre-opening", () => {
          beforeEach(async () => {
            await this.raiseOperators.addInvestor(investor1, { from: operator });
            await this.raiseOperators.addInvestor(investor2, { from: operator });
            await this.raiseOperators.addInvestor(investor3, { from: operator });
            await this.raiseOperators.addInvestor(investor4, { from: operator });
            await this.whitelist.batchToggleWhitelist([this.raise.address, issuer, investor1, investor2, investor3, investor4], true, { from: operator });
            await this.dchf.batchMint([investor1, investor2, investor3, investor4], new Array(4).fill(this.RAISE.max.mul(this.RAISE.price)), {
              from: operator,
            });
          });
          it("should revert on attacker", async () => {
            await expectRevert(this.raise.subscribe(getSubId(), 10, { from: attacker }), "RaiseOperatorable: caller is not investor");
          });
          it("should revert on investor", async () => {
            await expectRevert(this.raise.subscribe(getSubId(), 10, { from: investor1 }), "TimedRaise: not open");
          });
          it("should revert on any later stage function", async () => {
            // HERE
            await expectRevert(this.raise.issuerSubscription(getSubId(), true, { from: issuer }), "Raise: subscription does not exist");
            await expectRevert(this.raise.operatorFinalize(true, { from: operator }), "Raise: incorrect stage");
            await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
            await expectRevert(this.raise.close({ from: operator }), "TimedRaise: not closed");
          });
          describe("time travel", () => {
            beforeEach(async () => {
              await time.increaseTo(this.RAISE.open.add(time.duration.days(1)));
            });
            it("should revert on not available allowance", async () => {
              await expectRevert(this.raise.subscribe(getSubId(), this.RAISE.minShares.add(new BN(1)), { from: investor1 }), "Raise: above allowance");
            });
            it("should revert on below minimum subscription", async () => {
              await expectRevert(
                this.raise.subscribe(getSubId(), this.RAISE.minShares.sub(new BN(1)), { from: investor1 }),
                "Raise: below minimum subscription"
              );
            });
            describe("on single subscription", () => {
              beforeEach(async () => {
                this.SHARES[investor1].push({ val: this.RAISE.minShares.add(new BN(1)), approved: false, id: getSubId() });
                const cost = this.SHARES[investor1][0].val.mul(this.RAISE.price);
                await this.dchf.approve(this.raise.address, cost, { from: investor1 });
                this.tx = await this.raise.subscribe(this.SHARES[investor1][0].id, this.SHARES[investor1][0].val, { from: investor1 });
              });
              it("should have emitted subscription proposal event", async () => {
                expectEvent(this.tx, "SubscriptionProposal");
              });
              it("should have created a pending subscription", async () => {
                const sub = await this.raise.subscription(this.SHARES[investor1][0].id);
                assert.equal(sub.investor, investor1, "investor does not match");
                assert.equal(sub.shares.toString(), this.SHARES[investor1][0].val.toString(), "shares do not match");
                assert.equal(sub.cost.toString(), this.SHARES[investor1][0].val.mul(this.RAISE.price).toString(), "cost does not match");
                assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), "1", "subscription not created");
              });
              it("should have transferred tokens", async () => {
                const cost = this.SHARES[investor1][0].val.mul(this.RAISE.price);
                assert.equal(
                  (await this.dchf.balanceOf(investor1)).toString(),
                  this.RAISE.max.mul(this.RAISE.price).sub(cost).toString(),
                  "tokens were not transferred correctly"
                );
                assert.equal((await this.dchf.allowance(investor1, this.raise.address)).toString(), "0", "tokens were not drawn from allowance correctly");
              });
              it("should revert on non-issuer approval of subscription", async () => {
                await expectRevert(this.raise.issuerSubscription(this.SHARES[investor1][0].id, true, { from: attacker }), "Raise: caller not issuer");
                await expectRevert(this.raise.issuerSubscription(this.SHARES[investor1][0].id, true, { from: operator }), "Raise: caller not issuer");
              });
              describe("on subscription rejection", () => {
                beforeEach(async () => {
                  this.tx = await this.raise.issuerSubscription(this.SHARES[investor1][0].id, false, { from: issuer });
                });
                it("should have emitted reject subscription event", async () => {
                  expectEvent(this.tx, "SubscriptionDeclined");
                });
                it("should have deleted the pending subscription", async () => {
                  const sub = await this.raise.subscription(this.SHARES[investor1][0].id);
                  assert.equal(sub.investor, ZERO_ADDRESS, "investor does not match");
                  assert.equal(sub.shares.toString(), "0", "shares do not match");
                  assert.equal(sub.cost.toString(), "0", "cost does not match");
                  assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), "0", "subscription has invalid elements");
                  assert.equal((await this.raise.getSubscriptionTypeLength(true)).toString(), "0", "subscription has probably been incorrectly accepted");
                });
                it("should have increased the total declined", async () => {
                  const cost = this.SHARES[investor1][0].val.mul(this.RAISE.price);
                  assert.equal((await this.raise.totalDeclinedDeposits()).toString(), cost.toString(), "declined deposit not consinstent");
                  assert.equal((await this.raise.totalAcceptedDeposits()).toString(), "0", "approved deposit not consinstent");
                });
                it("should have transferred tokens back", async () => {
                  assert.equal(
                    (await this.dchf.balanceOf(investor1)).toString(),
                    this.RAISE.max.mul(this.RAISE.price).toString(),
                    "tokens were not correctly returned"
                  );
                });
              });
              describe("on subscription acceptance", () => {
                beforeEach(async () => {
                  this.tx = await this.raise.issuerSubscription(this.SHARES[investor1][0].id, true, { from: issuer });
                  this.SHARES[investor1][0].approved = true;
                });
                it("should have emitted accept subscription event", async () => {
                  expectEvent(this.tx, "SubscriptionAccepted");
                });
                it("should have approved the pending subscription", async () => {
                  const sub = await this.raise.subscription(this.SHARES[investor1][0].id);
                  assert.equal(sub.investor, investor1, "investor does not match");
                  assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), "0", "subscription has invalid elements");
                  assert.equal((await this.raise.getSubscriptionTypeLength(true)).toString(), "1", "subscription has probably not been accepted");
                });
                it("should have added investor as receiver", async () => {
                  assert.equal((await this.raise.getReceiversLength()).toString(), "1", "receiver does not match investor");
                  assert.equal(await this.raise.getReceiver(new BN(0)), investor1, "receiver does not match investor");
                });
                it("should have increased the total approved", async () => {
                  const cost = this.SHARES[investor1][0].val.mul(this.RAISE.price);
                  assert.equal((await this.raise.totalDeclinedDeposits()).toString(), "0", "declined deposit not consinstent");
                  assert.equal((await this.raise.totalAcceptedDeposits()).toString(), cost.toString(), "approved deposit not consinstent");
                });
                it("should have transferred tokens correctly", async () => {
                  const cost = this.SHARES[investor1][0].val.mul(this.RAISE.price);
                  assert.equal((await this.dchf.balanceOf(this.raise.address)).toString(), cost.toString(), "tokens were not correctly transferred");
                  assert.equal(
                    (await this.dchf.balanceOf(investor1)).toString(),
                    this.RAISE.max.mul(this.RAISE.price).sub(cost).toString(),
                    "tokens were not correctly transferred"
                  );
                });
              });
            });
            describe("on multiple subscriptions", () => {
              beforeEach(async () => {
                // GRANT ALLOWANCE
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor1 });
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor2 });
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor3 });
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor4 });
                // ACCEPT - Investor 1 - Investor 2 - Investor 3 - Investor 4
                this.SHARES[investor1].push(await processSubscription(this.raise, investor1, issuer, this.RAISE.minShares, true));
                this.SHARES[investor2].push(await processSubscription(this.raise, investor2, issuer, this.RAISE.minShares.mul(new BN(2)), true));
                this.SHARES[investor3].push(await processSubscription(this.raise, investor3, issuer, this.RAISE.minShares.mul(new BN(3)), true));
                this.SHARES[investor4].push(await processSubscription(this.raise, investor4, issuer, this.RAISE.minShares.mul(new BN(4)), true));
                // REJECT - Investor 2 - Investor 3 - Investor 4
                this.SHARES[investor2].push(
                  await processSubscription(this.raise, investor2, issuer, this.RAISE.minShares.add(new BN(1)).mul(new BN(2)), false)
                );
                this.SHARES[investor3].push(
                  await processSubscription(this.raise, investor3, issuer, this.RAISE.minShares.add(new BN(1)).mul(new BN(3)), false)
                );
                this.SHARES[investor4].push(
                  await processSubscription(this.raise, investor4, issuer, this.RAISE.minShares.add(new BN(1)).mul(new BN(4)), false)
                );
                // ACCEPT - Investor 2
                this.SHARES[investor2].push(await processSubscription(this.raise, investor2, issuer, this.RAISE.minShares.add(new BN(2)).mul(new BN(2)), true));
                // REJECT - Investor 3
                this.SHARES[investor3].push(
                  await processSubscription(this.raise, investor3, issuer, this.RAISE.minShares.add(new BN(2)).mul(new BN(3)), false)
                );
                // LEAVE PENDING - Investor 4 - Investor 1
                this.SHARES[investor4].push(
                  await processSubscription(this.raise, investor4, issuer, this.RAISE.minShares.add(new BN(2)).mul(new BN(4)), "pending")
                );
                this.SHARES[investor1].push(await processSubscription(this.raise, investor1, issuer, this.RAISE.minShares.add(new BN(2)), "pending"));
                this.subs = [...this.SHARES[investor1], ...this.SHARES[investor2], ...this.SHARES[investor3], ...this.SHARES[investor4]];
              });
              it("should have correct total accepted", async () => {
                const acceptedSubs = this.subs.filter((e) => {
                  return e.approved === true;
                });
                const totalAcceptedDeposits = acceptedSubs
                  .reduce((acc, e) => {
                    return acc.add(e.val);
                  }, new BN(0))
                  .mul(this.RAISE.price);
                assert.equal((await this.raise.totalAcceptedDeposits()).toString(), totalAcceptedDeposits.toString(), "Accepted deposits does not match");
                assert.equal((await this.raise.getSubscriptionTypeLength(true)).toString(), acceptedSubs.length.toString(), "Accepted deposits wrong size");
              });
              it("should have correct total declined", async () => {
                const totalDeclinedDeposits = this.subs
                  .filter((e) => {
                    return e.approved === false;
                  })
                  .reduce((acc, e) => {
                    return acc.add(e.val);
                  }, new BN(0))
                  .mul(this.RAISE.price);
                assert.equal((await this.raise.totalDeclinedDeposits()).toString(), totalDeclinedDeposits.toString(), "Declined deposits does not match");
              });
              it("should have correct total pending", async () => {
                const pendingSubs = this.subs.filter((e) => {
                  return e.approved === "pending";
                });
                const totalPendingDeposits = pendingSubs
                  .reduce((acc, e) => {
                    return acc.add(e.val);
                  }, new BN(0))
                  .mul(this.RAISE.price);
                assert.equal((await this.raise.totalPendingDeposits()).toString(), totalPendingDeposits.toString(), "Pending deposits does not match");
                assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), pendingSubs.length.toString(), "Pending deposits wrong size");
              });
              it("should match subIDs for investor 1", async () => {
                const approvedSubIDs = (await this.raise.getSubIDs(investor1, true)).map((e) => {
                  return e.toString();
                });
                const pendingSubIDs = (await this.raise.getSubIDs(investor1, false)).map((e) => {
                  return e.toString();
                });
                assert.deepEqual(
                  approvedSubIDs,
                  this.SHARES[investor1]
                    .filter((e) => {
                      return e.approved === true;
                    })
                    .map((e) => {
                      return e.id;
                    }),
                  "approved SubIDs not matching"
                );
                assert.deepEqual(
                  pendingSubIDs,
                  this.SHARES[investor1]
                    .filter((e) => {
                      return e.approved === "pending";
                    })
                    .map((e) => {
                      return e.id;
                    }),
                  "pending SubIDs not matching"
                );
              });
              it("should match deposit for investor 2", async () => {
                const approvedDeposit = (await this.raise.getDeposits(investor2, true)).toString();
                const pendingDeposit = (await this.raise.getDeposits(investor2, false)).toString();
                assert.equal(
                  approvedDeposit,
                  this.SHARES[investor2]
                    .filter((e) => {
                      return e.approved === true;
                    })
                    .reduce((acc, e) => {
                      return acc.add(e.val.mul(this.RAISE.price));
                    }, new BN(0))
                    .toString(),
                  "approved deposit not matching"
                );
                assert.equal(
                  pendingDeposit,
                  this.SHARES[investor2]
                    .filter((e) => {
                      return e.approved === "pending";
                    })
                    .reduce((acc, e) => {
                      return acc.add(e.val.mul(this.RAISE.price));
                    }, new BN(0))
                    .toString(),
                  "pending deposit not matching"
                );
              });
              it("should match deposit for investor 3", async () => {
                const approvedDeposit = (await this.raise.getDeposits(investor3, true)).toString();
                const pendingDeposit = (await this.raise.getDeposits(investor3, false)).toString();
                assert.equal(
                  approvedDeposit,
                  this.SHARES[investor3]
                    .filter((e) => {
                      return e.approved === true;
                    })
                    .reduce((acc, e) => {
                      return acc.add(e.val.mul(this.RAISE.price));
                    }, new BN(0))
                    .toString(),
                  "approved deposit not matching"
                );
                assert.equal(
                  pendingDeposit,
                  this.SHARES[investor3]
                    .filter((e) => {
                      return e.approved === "pending";
                    })
                    .reduce((acc, e) => {
                      return acc.add(e.val.mul(this.RAISE.price));
                    }, new BN(0))
                    .toString(),
                  "pending deposit not matching"
                );
              });
              it("should match subIDs for investor 4", async () => {
                const approvedSubIDs = (await this.raise.getSubIDs(investor4, true)).map((e) => {
                  return e.toString();
                });
                const pendingSubIDs = (await this.raise.getSubIDs(investor4, false)).map((e) => {
                  return e.toString();
                });
                assert.deepEqual(
                  approvedSubIDs,
                  this.SHARES[investor4]
                    .filter((e) => {
                      return e.approved === true;
                    })
                    .map((e) => {
                      return e.id;
                    }),
                  "approved SubIDs not matching"
                );
                assert.deepEqual(
                  pendingSubIDs,
                  this.SHARES[investor4]
                    .filter((e) => {
                      return e.approved === "pending";
                    })
                    .map((e) => {
                      return e.id;
                    }),
                  "pending SubIDs not matching"
                );
              });
              it("should give correct receivers", async () => {
                assert.deepEqual(await this.raise.getReceiversBatch(0, 4), [investor1, investor2, investor3, investor4], "receivers batch not matching");
              });
              it("should revert on invalid calls", async () => {
                await expectRevert(this.raise.getReceiversBatch(4, 0), "CappedRaise: Wrong receivers array indices");
                await expectRevert(this.raise.getReceiversBatch(0, 257), "CappedRaise: Greater than block limit");
              });
              describe("reach min cap", () => {
                beforeEach(async () => {
                  const minShare = (await this.raise.getMinCap()).sub(await this.raise.getSold());
                  if (minShare.eq(0)) return;
                  this.SHARES[investor1].push(await processSubscription(this.raise, investor1, issuer, minShare, true));
                });
                it("should have reached min cap", async () => {
                  assert.equal(await this.raise.minCapReached(), true, "min cap should be reached");
                });
                it("should be still open", async () => {
                  assert.equal(await this.raise.hasClosed(), false, "raise has already closed");
                });
                describe("time travel to close", () => {
                  beforeEach(async () => {
                    await time.increaseTo(this.RAISE.close.add(time.duration.seconds(10)));
                    await time.advanceBlock();
                  });
                  it("should be closed", async () => {
                    assert.equal(await this.raise.hasClosed(), true, "raise is still open");
                  });
                  it("should revert on invalid functions", async () => {
                    await expectRevert(this.raise.issuerClose(true, { from: operator }), "Raise: caller not issuer");
                    await expectRevert(this.raise.issuerClose(true, { from: attacker }), "Raise: caller not issuer");
                    await expectRevert(this.raise.batchReleasePending([investor1, investor2], { from: operator }), "Raise: not at correct stage");
                  });
                  describe("reject raise", () => {
                    beforeEach(async () => {
                      this.tx = await this.raise.issuerClose(false, { from: issuer });
                      await this.raise.batchReleasePending([investor1, investor2, investor3, investor4], { from: operator });
                    });
                    it("should have emitted close event", async () => {
                      expectEvent(this.tx, "RaiseClosed");
                    });
                    it("should have emptied pending deposits", async () => {
                      assert.equal((await this.raise.getDeposits(investor1, false)).toString(), "0", "deposits not emptied");
                      assert.equal((await this.raise.getDeposits(investor4, false)).toString(), "0", "deposits not emptied");
                    });
                    it("should be in correct stage", async () => {
                      assert.equal((await this.raise.stage()).toString(), "1", "wrong stage");
                    });
                    it("should revert on finalize", async () => {
                      await expectRevert(this.raise.operatorFinalize(true, { from: attacker }), "Operatorable: caller does not have the operator role");
                      await expectRevert(this.raise.operatorFinalize(true, { from: operator }), "Raise: incorrect stage");
                      await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
                    });
                    it("should revert on close before fund release", async () => {
                      await expectRevert(this.raise.close({ from: operator }), "Raise: not emptied");
                    });
                    describe("release all funds", () => {
                      beforeEach(async () => {
                        await this.raise.releaseAllFunds([investor1, investor2], { from: operator });
                        await this.raise.releaseAllFunds([investor3, investor4], { from: operator });
                      });
                      it("should have emptied the deposits", async () => {
                        assert.equal((await this.raise.getDeposits(investor1, true)).toString(), "0", "deposits not emptied");
                        assert.equal((await this.raise.getDeposits(investor2, true)).toString(), "0", "deposits not emptied");
                        assert.equal((await this.raise.getDeposits(investor3, true)).toString(), "0", "deposits not emptied");
                        assert.equal((await this.raise.getDeposits(investor4, true)).toString(), "0", "deposits not emptied");
                      });
                      it("should have no more active subscriptions", async () => {
                        assert.deepEqual(await this.raise.getSubIDs(investor1, true), [], "subscription investor1 not emptied");
                        assert.deepEqual(await this.raise.getSubIDs(investor2, true), [], "subscription investor2 not emptied");
                        assert.deepEqual(await this.raise.getSubIDs(investor3, true), [], "subscription investor3 not emptied");
                        assert.deepEqual(await this.raise.getSubIDs(investor4, true), [], "subscription investor4 not emptied");
                      });
                      it("should have no subscritpions", async () => {
                        assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), "0", "pending subscriptions present");
                        assert.equal((await this.raise.getSubscriptionTypeLength(true)).toString(), "0", "approved subscriptions present");
                      });
                      it("should give correct original balances", async () => {
                        assert.equal(
                          (await this.dchf.balanceOf(investor1)).toString(),
                          this.RAISE.max.mul(this.RAISE.price).toString(),
                          "investor1 wrong balance"
                        );
                        assert.equal(
                          (await this.dchf.balanceOf(investor2)).toString(),
                          this.RAISE.max.mul(this.RAISE.price).toString(),
                          "investor2 wrong balance"
                        );
                        assert.equal(
                          (await this.dchf.balanceOf(investor3)).toString(),
                          this.RAISE.max.mul(this.RAISE.price).toString(),
                          "investor3 wrong balance"
                        );
                        assert.equal(
                          (await this.dchf.balanceOf(investor4)).toString(),
                          this.RAISE.max.mul(this.RAISE.price).toString(),
                          "investor4 wrong balance"
                        );
                      });
                      describe("close raise", () => {
                        beforeEach(async () => {
                          this.tx = await this.raise.close({ from: operator });
                        });
                        it("should be in correct stage", async () => {
                          assert.equal((await this.raise.stage()).toString(), "4", "wrong stage");
                        });
                        it("should have emitted close event", async () => {
                          expectEvent(this.tx, "OperatorClosed");
                        });
                      });
                    });
                  });
                  describe("accept raise", () => {
                    beforeEach(async () => {
                      this.tx = await this.raise.issuerClose(true, { from: issuer });
                    });
                    it("should have emitted close event", async () => {
                      expectEvent(this.tx, "RaiseClosed");
                    });
                    it("should be in correct stage", async () => {
                      assert.equal((await this.raise.stage()).toString(), "2", "wrong stage");
                    });
                    it("should revert on invalid functions", async () => {
                      const subId = this.SHARES[investor1].filter((e) => {
                        return e.approved === "pending";
                      })[0].id;
                      await expectRevert(this.raise.issuerSubscription(subId, true, { from: issuer }), "Raise: not at correct stage");
                      await expectRevert(this.raise.issuerClose(true, { from: issuer }), "Raise: not at correct stage");
                      await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
                      await expectRevert(this.raise.close({ from: operator }), "Raise: not at correct stage");
                    });
                    describe("operator rejects", () => {
                      beforeEach(async () => {
                        this.tx = await this.raise.operatorFinalize(false, { from: operator });
                      });
                      it("should have emitted finalize event", async () => {
                        expectEvent(this.tx, "OperatorRaiseFinalization");
                      });
                      it("should be in correct stage", async () => {
                        assert.equal((await this.raise.stage()).toString(), "1", "wrong stage");
                      });
                      it("should revert on invalid functions", async () => {
                        await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
                        await expectRevert(this.raise.close({ from: operator }), "Raise: pending not emptied");
                      });
                      describe("release all funds", () => {
                        beforeEach(async () => {
                          await this.raise.releaseAllFunds([investor1, investor2, investor3, investor4], { from: operator });
                        });
                        it("should have no subscritpions", async () => {
                          assert.equal((await this.raise.getSubscriptionTypeLength(false)).toString(), "0", "pending subscriptions present");
                          assert.equal((await this.raise.getSubscriptionTypeLength(true)).toString(), "0", "approved subscriptions present");
                        });
                        it("should give correct original balances", async () => {
                          assert.equal(
                            (await this.dchf.balanceOf(investor1)).toString(),
                            this.RAISE.max.mul(this.RAISE.price).toString(),
                            "investor1 wrong balance"
                          );
                          assert.equal(
                            (await this.dchf.balanceOf(investor2)).toString(),
                            this.RAISE.max.mul(this.RAISE.price).toString(),
                            "investor2 wrong balance"
                          );
                          assert.equal(
                            (await this.dchf.balanceOf(investor3)).toString(),
                            this.RAISE.max.mul(this.RAISE.price).toString(),
                            "investor3 wrong balance"
                          );
                          assert.equal(
                            (await this.dchf.balanceOf(investor4)).toString(),
                            this.RAISE.max.mul(this.RAISE.price).toString(),
                            "investor4 wrong balance"
                          );
                        });
                        describe("close raise", () => {
                          beforeEach(async () => {
                            this.tx = await this.raise.close({ from: operator });
                          });
                          it("should be in correct stage", async () => {
                            assert.equal((await this.raise.stage()).toString(), "4", "wrong stage");
                          });
                          it("should have emitted close event", async () => {
                            expectEvent(this.tx, "OperatorClosed");
                          });
                          it("should revert on invalid functions", async () => {
                            await expectRevert(this.raise.subscribe(getSubId(), this.RAISE.min, { from: investor1 }), "Raise: not at correct stage");
                            await expectRevert(this.raise.issuerClose(true, { from: issuer }), "Raise: not at correct stage");
                            await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
                            await expectRevert(this.raise.close({ from: operator }), "Raise: not at correct stage");
                          });
                        });
                      });
                    });
                    describe("operator approves", () => {
                      beforeEach(async () => {
                        this.tx = await this.raise.operatorFinalize(true, { from: operator });
                        await this.raise.batchReleasePending([investor1, investor2, investor3, investor4], { from: operator });
                      });
                      it("should have emitted finalize event", async () => {
                        expectEvent(this.tx, "OperatorRaiseFinalization");
                      });
                      it("should be in correct stage", async () => {
                        assert.equal((await this.raise.stage()).toString(), "3", "wrong stage");
                      });
                      it("should revert on invalid functions", async () => {
                        const subId = this.SHARES[investor1].filter((e) => {
                          return e.approved === "pending";
                        })[0].id;
                        await expectRevert(this.raise.issuerSubscription(subId, true, { from: issuer }), "Raise: not at correct stage");
                        await expectRevert(this.raise.releaseAllFunds([investor1], { from: operator }), "Raise: not at correct stage");
                        await expectRevert(this.raise.close({ from: operator }), "Raise: issuer not been paid");
                      });
                      it("should give correct share amounts", async () => {
                        assert.equal(
                          (await this.raise.getShares(investor1)).toString(),
                          this.SHARES[investor1]
                            .filter((e) => {
                              return e.approved === true;
                            })
                            .reduce((acc, e) => {
                              return acc.add(e.val);
                            }, new BN(0))
                            .toString(),
                          "investor1 share not correct"
                        );
                        assert.equal(
                          (await this.raise.getShares(investor2)).toString(),
                          this.SHARES[investor2]
                            .filter((e) => {
                              return e.approved === true;
                            })
                            .reduce((acc, e) => {
                              return acc.add(e.val);
                            }, new BN(0))
                            .toString(),
                          "investor2 share not correct"
                        );
                        assert.equal(
                          (await this.raise.getShares(investor3)).toString(),
                          this.SHARES[investor3]
                            .filter((e) => {
                              return e.approved === true;
                            })
                            .reduce((acc, e) => {
                              return acc.add(e.val);
                            }, new BN(0))
                            .toString(),
                          "investor3 share not correct"
                        );
                        assert.equal(
                          (await this.raise.getShares(investor4)).toString(),
                          this.SHARES[investor4]
                            .filter((e) => {
                              return e.approved === true;
                            })
                            .reduce((acc, e) => {
                              return acc.add(e.val);
                            }, new BN(0))
                            .toString(),
                          "investor4 share not correct"
                        );
                      });
                      describe("release funds to issuer", () => {
                        beforeEach(async () => {
                          this.tx = await this.raise.releaseToIssuer({ from: operator });
                        });
                        it("should have emitted finalize event", async () => {
                          expectEvent(this.tx, "IssuerPaid");
                        });
                        it("should release to issuer all funds", async () => {
                          this.subs = [...this.SHARES[investor1], ...this.SHARES[investor2], ...this.SHARES[investor3], ...this.SHARES[investor4]];
                          assert.equal(
                            (await this.dchf.balanceOf(issuer)).toString(),
                            this.subs
                              .filter((e) => {
                                return e.approved === true;
                              })
                              .reduce((acc, e) => {
                                return acc.add(e.val.mul(this.RAISE.price));
                              }, new BN(0))
                              .toString(),
                            "issuer wrong balance"
                          );
                          assert.equal(
                            (await this.dchf.balanceOf(issuer)).toString(),
                            (await this.raise.totalAcceptedDeposits()).toString(),
                            "mismatch balance with deposit counter"
                          );
                        });
                        it("should revert on invalid functions", async () => {
                          await expectRevert(this.raise.operatorFinalize(false, { from: operator }), "Raise: incorrect stage");
                          await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: issuer already paid");
                          await expectRevert(this.raise.releaseAllFunds([investor1], { from: operator }), "Raise: not at correct stage");
                        });
                        describe("close raise", () => {
                          beforeEach(async () => {
                            this.tx = await this.raise.close({ from: operator });
                          });
                          it("should have emitted close event", async () => {
                            expectEvent(this.tx, "OperatorClosed");
                          });
                          it("should give correct final balances", async () => {
                            const original = this.RAISE.max.mul(this.RAISE.price);
                            assert.equal(
                              (await this.dchf.balanceOf(investor1)).toString(),
                              original
                                .sub(
                                  this.SHARES[investor1]
                                    .filter((e) => {
                                      return e.approved === true;
                                    })
                                    .reduce((acc, e) => {
                                      return acc.add(e.val.mul(this.RAISE.price));
                                    }, new BN(0))
                                )
                                .toString(),
                              "investor1 wrong balance"
                            );
                            assert.equal(
                              (await this.dchf.balanceOf(investor2)).toString(),
                              original
                                .sub(
                                  this.SHARES[investor2]
                                    .filter((e) => {
                                      return e.approved === true;
                                    })
                                    .reduce((acc, e) => {
                                      return acc.add(e.val.mul(this.RAISE.price));
                                    }, new BN(0))
                                )
                                .toString(),
                              "investor2 wrong balance"
                            );
                            assert.equal(
                              (await this.dchf.balanceOf(investor3)).toString(),
                              original
                                .sub(
                                  this.SHARES[investor3]
                                    .filter((e) => {
                                      return e.approved === true;
                                    })
                                    .reduce((acc, e) => {
                                      return acc.add(e.val.mul(this.RAISE.price));
                                    }, new BN(0))
                                )
                                .toString(),
                              "investor3 wrong balance"
                            );
                            assert.equal(
                              (await this.dchf.balanceOf(investor4)).toString(),
                              original
                                .sub(
                                  this.SHARES[investor4]
                                    .filter((e) => {
                                      return e.approved === true;
                                    })
                                    .reduce((acc, e) => {
                                      return acc.add(e.val.mul(this.RAISE.price));
                                    }, new BN(0))
                                )
                                .toString(),
                              "investor4 wrong balance"
                            );
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
            describe("on max cap met", () => {
              beforeEach(async () => {
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor1 });
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor2 });
                // PENDING - Investor 4
                this.SHARES[investor4].push(await processSubscription(this.raise, investor1, issuer, this.RAISE.minShares, "pending"));
                // ACCEPT - Investor 1 - Investor 2
                this.SHARES[investor1].push(await processSubscription(this.raise, investor1, issuer, this.RAISE.max.div(new BN(2)), true));
                this.SHARES[investor2].push(await processSubscription(this.raise, investor2, issuer, await this.raise.getAvailableShares(), true));
              });
              it("should fail on a new subscribe", async () => {
                await expectRevert(this.raise.subscribe(getSubId(), this.RAISE.minShares, { from: investor3 }), "Raise: above available");
              });
              it("should have reached the max cap", async () => {
                assert.equal(await this.raise.maxCapReached(), true, "max cap were not met");
              });
              it("should fail on approving a new subscription", async () => {
                await expectRevert(this.raise.issuerSubscription(this.SHARES[investor4][0].id, true, { from: issuer }), "Raise: max sold already met");
              });
            });
            describe("on min cap unmet", () => {
              beforeEach(async () => {
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor1 });
                await this.dchf.approve(this.raise.address, this.RAISE.max.mul(this.RAISE.price), { from: investor2 });
                // ACCEPT - Investor 1 - Investor 2
                this.SHARES[investor1].push(await processSubscription(this.raise, investor1, issuer, this.RAISE.min.div(new BN(2)).sub(new BN(1)), true));
                this.SHARES[investor2].push(await processSubscription(this.raise, investor2, issuer, this.RAISE.min.div(new BN(2)).sub(new BN(1)), true));
              });
              it("should have not reached min cap", async () => {
                assert.equal(await this.raise.minCapReached(), false, "min cap reached unexpectedly");
              });
              describe("time travel", () => {
                beforeEach(async () => {
                  await time.increaseTo(this.RAISE.close.add(time.duration.seconds(10)));
                  await time.advanceBlock();
                });
                it("should be closed", async () => {
                  assert.equal(await this.raise.hasClosed(), true, "raise is still open");
                });
                describe("issuer close", () => {
                  beforeEach(async () => {
                    this.tx = await this.raise.issuerClose(true, { from: issuer });
                  });
                  it("should have emitted close event", async () => {
                    expectEvent(this.tx, "UnsuccessfulRaise");
                  });
                  it("should be in correct stage", async () => {
                    assert.equal((await this.raise.stage()).toString(), "1", "wrong stage");
                  });
                  it("should revert on invalid functions", async () => {
                    await expectRevert(this.raise.releaseToIssuer({ from: operator }), "Raise: not at correct stage");
                    await expectRevert(this.raise.operatorFinalize(true, { from: operator }), "Raise: incorrect stage");
                    await expectRevert(this.raise.close({ from: operator }), "Raise: not emptied");
                  });
                  describe("release all funds", () => {
                    beforeEach(async () => {
                      await this.raise.releaseAllFunds([investor1, investor2], { from: operator });
                      this.tx = await this.raise.close({ from: operator });
                    });
                    it("should have emitted close event", async () => {
                      expectEvent(this.tx, "OperatorClosed");
                    });
                    it("should have returned money", async () => {
                      assert.equal(
                        (await this.dchf.balanceOf(investor1)).toString(),
                        this.RAISE.max.mul(this.RAISE.price).toString(),
                        "investor1 wrong balance"
                      );
                      assert.equal(
                        (await this.dchf.balanceOf(investor2)).toString(),
                        this.RAISE.max.mul(this.RAISE.price).toString(),
                        "investor2 wrong balance"
                      );
                    });
                    it("should revert on invalid functions", async () => {
                      await expectRevert(this.raise.operatorFinalize(false, { from: operator }), "Raise: incorrect stage");
                    });
                    it("should have no deposit left", async () => {
                      assert.equal((await this.raise.getDeposits(investor1, true)).toString(), "0", "investor1 wrong deposits");
                      assert.equal((await this.raise.getDeposits(investor2, true)).toString(), "0", "investor2 wrong deposits");
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
