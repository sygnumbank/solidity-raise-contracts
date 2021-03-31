/**
 * @title TimedRaise
 * @author Team 3301 <team3301@sygnum.com>
 * @dev This contract implements time limitations upon contributions.
 */

pragma solidity 0.5.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract TimedRaise {
    using SafeMath for uint256;

    uint256 private openingTime;
    uint256 private closingTime;

    /**
     * @dev Reverts if not in raise time range.
     */
    modifier onlyWhileOpen {
        require(isOpen(), "TimedRaise: not open");
        _;
    }

    /**
     * @dev Reverts if not after raise time range.
     */
    modifier onlyWhenClosed {
        require(hasClosed(), "TimedRaise: not closed");
        _;
    }

    /**
     * @dev sets raise opening and closing times.
     * @param _openingTime uint256 Opening time for raise.
     * @param _closingTime uint256 Closing time for raise.
     */
    function _setTime(uint256 _openingTime, uint256 _closingTime) internal {
        // solhint-disable-next-line not-rely-on-time
        require(_openingTime >= block.timestamp, "TimedRaise: opening time is before current time");
        require(_closingTime > _openingTime, "TimedRaise: opening time is not before closing time");

        openingTime = _openingTime;
        closingTime = _closingTime;
    }

    /**
     * @return the raise opening time.
     */
    function getOpening() public view returns (uint256) {
        return openingTime;
    }

    /**
     * @return the raise closing time.
     */
    function getClosing() public view returns (uint256) {
        return closingTime;
    }

    /**
     * @dev Checks whether the raise is still open.
     * @return true if the raise is open, false otherwise.
     */
    function isOpen() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return now >= openingTime && now <= closingTime;
    }

    /**
     * @dev Checks whether the period in which the raise is open has already elapsed.
     * @return Whether raise period has elapsed
     */
    function hasClosed() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return now > closingTime;
    }
}
