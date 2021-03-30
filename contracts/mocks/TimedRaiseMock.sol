/**
 * @title TimedRaiseMock
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Mock contract for validating opening and closing time for a capital raise.
 *      This contract is excluded from the audit.
 */

pragma solidity 0.5.12;

import "../raise/TimedRaise.sol";

contract TimedRaiseMock is TimedRaise {
    bool public OpenAction;

    /**
     * @dev Constructor set opening and closing time.
     * @param _openingTime uint256 Opening time for raise.
     * @param _closingTime uint256 Closing time for raise.
     */
    constructor(uint256 _openingTime, uint256 _closingTime) public {
        _setTime(_openingTime, _closingTime);
    }

    /**
     * @dev Validating open action
     */
    function openAction() public onlyWhileOpen {
        OpenAction = true;
    }
}
