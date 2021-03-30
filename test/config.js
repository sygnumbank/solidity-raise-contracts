const { BN } = require("@openzeppelin/test-helpers");

// RAISE CONFIG FOR TEST FOLDER
module.exports = {
  RAISE: {
    min: new BN(1000), // number of shares
    max: new BN(100000), // number of shares
    price: new BN(2.5 * 100), // in dchf
    minSubscription: new BN(100 * 100), // in dchf
    duration: 10, // in Days
    subscriptionPurchase: 500, // in dchf
  },
};
