/**
 * @title RaiseDeployer
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Library to deploy and initialize a new instance of Sygnum Equity Token.
 * This is commonly used by a TokenFactory to automatically deploy and configure
 */

pragma solidity 0.5.12;

import "../raise/Raise.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library RaiseDeployer {
    function deployRaise() public returns (address) {
        Raise raise = new Raise();
        return address(raise);
    }

    function initializeRaise(
        address _proxy,
        IERC20 _dchf,
        address _issuer,
        uint256 _min,
        uint256 _max,
        uint256 _price,
        uint256 _subscription,
        uint256 _opening,
        uint256 _closing,
        address _baseOperators,
        address _raiseOperators
    ) public {
        Raise(_proxy).initialize(
            _dchf,
            _issuer,
            _min,
            _max,
            _price,
            _subscription,
            _opening,
            _closing,
            _baseOperators,
            _raiseOperators
        );
    }
}
