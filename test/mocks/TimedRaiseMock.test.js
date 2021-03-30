const { time, expectRevert, TimedRaiseMock } = require("../common");

contract("TimedRaiseMock", ([user]) => {
  beforeEach(async () => {
    this.duration1Day = time.duration.days(1);
    this.duration10Minutes = time.duration.minutes(10);
  });
  describe("initialization", () => {
    describe("non-functional", () => {
      beforeEach(async () => {
        await time.advanceBlock();
        this.current = await time.latest();
      });
      it("revert deployment with opening less than current time", async () => {
        await expectRevert(
          TimedRaiseMock.new(this.current - this.duration1Day, this.current + this.duration1Day),
          "TimedRaise: opening time is before current time"
        );
      });
      it("revert deployment with closing time less than opening time", async () => {
        await expectRevert(
          TimedRaiseMock.new(this.current + this.duration1Day, this.current - this.duration1Day),
          "TimedRaise: opening time is not before closing time"
        );
      });
    });
    describe("functional deployment1", () => {
      beforeEach(async () => {
        this.current = await time.latest();
        this.opening = parseFloat(this.current) + parseFloat(this.duration10Minutes); // open in 10 minutes
        this.closing = parseFloat(this.current) + parseFloat(this.duration1Day); // closes in 1 day
        this.mock = await TimedRaiseMock.new(this.opening, this.closing);
      });
      describe("variable initialized", () => {
        it("opening time", async () => {
          assert.equal(await this.mock.getOpening(), this.opening);
        });
        it("closing time", async () => {
          assert.equal(await this.mock.getClosing(), this.closing);
        });
        it("open", async () => {
          assert.equal(await this.mock.isOpen(), false);
        });
        it("hasClosed", async () => {
          assert.equal(await this.mock.hasClosed(), false);
        });
      });
      it("revert open functionality when not open", async () => {
        await expectRevert(this.mock.openAction(), "TimedRaise: not open");
      });
      describe("time manipulation", () => {
        describe("non-functional: increase greater than close", () => {
          beforeEach(async () => {
            await time.increaseTo(parseFloat(this.opening) + parseFloat(this.duration1Day));
          });
          it("hasClosed", async () => {
            assert.equal(await this.mock.hasClosed(), true);
          });
          it("isOpen", async () => {
            assert.equal(await this.mock.isOpen(), false);
          });
        });
        describe("functional: increase to open time", () => {
          beforeEach(async () => {
            await time.increaseTo(this.opening);
          });
          it("isOpen", async () => {
            assert.equal(await this.mock.isOpen(), true);
          });
          it("open functionality operational", async () => {
            await this.mock.openAction();
            assert.equal(await this.mock.OpenAction(), true);
          });
        });
      });
    });
  });
});
