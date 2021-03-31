/**
 * @title CappedRaiseMock
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Mock contract for validating min and max cap for a capital raise.
 *      This contract is excluded from the audit.
 */

pragma solidity 0.5.12;

import "../raise/CappedRaise.sol";

contract CappedRaiseMock is CappedRaise {
    bool OnlyWhileMaxCapNotMet;

    /**
     * @dev Constructor set min and cap max.
     * @param _minCap uint256 Min cap for raise.
     * @param _maxCap uint256 Max cap for raise.
     */
    constructor(uint256 _minCap, uint256 _maxCap) public {
        _setCap(_minCap, _maxCap);
    }

    /**
     * @dev Update sold amount.
     * @param _payee address Of purchaser.
     * @param _shares uint256 Amount for purchaser.
     */
    function updateSold(address _payee, uint256 _shares) public {
        require(!maxCapReached(), "CappedRaiseMock: max cap reached");
        _updateSold(_payee, _shares);
    }
}
