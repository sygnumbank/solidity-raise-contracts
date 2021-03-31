const { RAISE } = require("../config");
const { expectRevert, CappedRaiseMock } = require("../common");

contract("CappedRaiseMock", ([user, anotherUser]) => {
  it("revert deployment with zero min cap", async () => {
    await expectRevert(CappedRaiseMock.new(0, RAISE.max), "CappedRaise: minimum cap must exceed zero.");
  });

  it("revert deployment with wrong min-max caps relation", async () => {
    await expectRevert(CappedRaiseMock.new(RAISE.max, RAISE.min), "CappedRaise: maximum cap must exceed minimum cap.");
  });

  context("mock initialization", () => {
    beforeEach(async () => {
      this.mock = await CappedRaiseMock.new(RAISE.min, RAISE.max);
    });
    it("min cap initialized", async () => {
      assert.equal((await this.mock.getMinCap()).toString(), RAISE.min.toString());
    });
    it("max cap initialized", async () => {
      assert.equal((await this.mock.getMaxCap()).toString(), RAISE.max.toString());
    });
    describe("when max cap not met purchase", () => {
      beforeEach(async () => {
        await this.mock.updateSold(user, RAISE.subscriptionPurchase);
      });
      describe("variable update", () => {
        it("user shares", async () => {
          assert.equal(await this.mock.getShares(user), RAISE.subscriptionPurchase);
        });
        it("available shares", async () => {
          assert.equal(await this.mock.getAvailableShares(), RAISE.max - RAISE.subscriptionPurchase);
        });
        it("sold", async () => {
          assert.equal(await this.mock.getSold(), RAISE.subscriptionPurchase);
        });
        it("max cap reached", async () => {
          assert.equal(await this.mock.maxCapReached(), false);
        });
      });
      describe("receivers update", () => {
        beforeEach(async () => {
          await this.mock.updateSold(anotherUser, RAISE.subscriptionPurchase);
        });
        it("length updated", async () => {
          assert.equal(await this.mock.getReceiversLength(), 2);
        });
        describe("receiver indexes", () => {
          it("first receiver", async () => {
            assert.equal(await this.mock.getReceiver(0), user);
          });
          it("second receiver", async () => {
            assert.equal(await this.mock.getReceiver(1), anotherUser);
          });
        });
        describe("batch retrieve", () => {
          beforeEach(async () => {
            this.batch = await this.mock.getReceiversBatch(0, 2);
          });
          it("first receiver", async () => {
            assert.equal(this.batch[0], user);
          });
          it("second receiver", async () => {
            assert.equal(this.batch[1], anotherUser);
          });
        });
      });
    });
    describe("when max cap met purchase", () => {
      beforeEach(async () => {
        await this.mock.updateSold(user, RAISE.max);
      });
      describe("variable update", () => {
        it("user shares", async () => {
          assert.equal((await this.mock.getShares(user)).toString(), RAISE.max.toString());
        });
        it("available shares", async () => {
          assert.equal(await this.mock.getAvailableShares(), 0);
        });
        it("sold", async () => {
          assert.equal((await this.mock.getSold()).toString(), RAISE.max.toString());
        });
        it("max cap reached", async () => {
          assert.equal(await this.mock.maxCapReached(), true);
        });
        it("min cap reached", async () => {
          assert.equal(await this.mock.minCapReached(), true);
        });
      });
      describe("non-functional", () => {
        it("reverts when cap has been met", async () => {
          await expectRevert(this.mock.updateSold(user, RAISE.max), "CappedRaiseMock: max cap reached");
        });
      });
    });
  });
});
