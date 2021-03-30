/**
 * @title ProxyDeployer
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Library to deploy a proxy instance for a Sygnum.
 */

pragma solidity 0.5.12;

import "../factory/SygnumProxy.sol";

library ProxyDeployer {
    /**
     * @dev Deploy the proxy instance and initialize it
     * @param _implementation Address of the logic contract
     * @param _proxyAdmin Address of the admin for the proxy
     * @param _data Bytecode needed for initialization
     * @return address New instance address
     */
    function deployProxy(
        address _implementation,
        address _proxyAdmin,
        bytes memory _data
    ) public returns (address) {
        SygnumProxy proxy = new SygnumProxy(_implementation, _proxyAdmin, _data);
        return address(proxy);
    }
}
