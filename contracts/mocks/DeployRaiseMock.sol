/**
 * @title DeployRaiseMock
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Mock contract for validating deployment of raise logic contract.
 */

pragma solidity 0.5.12;

import "../libraries/RaiseDeployer.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployRaiseMock {
    event RaiseDeployed(address indexed raise);

    /**
     * @dev Deploy raise logic.
     */
    function deployAndInitialize(
        address _dchf,
        address _issuer,
        uint256 _min,
        uint256 _max,
        uint256 _price,
        uint256 _subscription,
        uint256 _opening,
        uint256 _closing,
        address _baseOperators,
        address _raiseOperators
    ) public returns (address _raise) {
        _raise = RaiseDeployer.deployRaise();
        RaiseDeployer.initializeRaise(
            _raise,
            IERC20(_dchf),
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
        emit RaiseDeployed(_raise);
    }
}
