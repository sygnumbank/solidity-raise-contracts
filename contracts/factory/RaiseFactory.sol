/**
 * @title RaiseFactory
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Raise factory to be used by operators to deploy arbitrary Sygnum Capital Raise.
 */

pragma solidity 0.5.12;

import "@sygnum/solidity-base-contracts/contracts/helpers/Initializable.sol";
import "@sygnum/solidity-base-contracts/contracts/role/raise/RaiseOperatorable.sol";

import "../libraries/RaiseDeployer.sol";
import "../libraries/ProxyDeployer.sol";

contract RaiseFactory is Initializable, RaiseOperatorable {
    IERC20 public dchf;
    address public proxyAdmin;
    address public implementation;

    mapping(bytes32 => Raise) public raise;

    struct Raise {
        address implementation;
        address proxy;
        address issuer;
        address token;
    }

    event UpdatedProxyAdmin(address indexed proxyAdmin);
    event UpdatedImplementation(address indexed implementation);
    event NewProposal(address indexed issuer, bytes32 indexed identifier);
    event ProposalAccepted(
        address indexed issuer,
        bytes32 indexed identifier,
        address raise,
        address proxy,
        address token
    );
    event ProposalDeclined(
        address indexed issuer,
        bytes32 indexed identifier,
        address indexed operator,
        uint256 timestamp
    );

    /**
     * @dev Initialization instead of constructor, called once to initialize all the necessary values.
     * @param _dchf DCHF proxy contract address.
     * @param _baseOperators BaseOperators contract address.
     * @param _raiseOperators RaiseOperators contract address.
     * @param _proxyAdmin Default proxy admin address.
     * @param _implementation Raise implementation pointer address.
     */
    function initialize(
        IERC20 _dchf,
        address _baseOperators,
        address _raiseOperators,
        address _proxyAdmin,
        address _implementation
    ) public initializer {
        require(address(_dchf) != address(0), "RaiseFactory: _dchf cannot be set to an empty address");
        require(_proxyAdmin != address(0), "RaiseFactory: _proxyAdmin cannot be set to an empty address");
        require(_implementation != address(0), "RaiseFactory: _implementation cannot be set to an empty address");
        dchf = _dchf;
        proxyAdmin = _proxyAdmin;
        implementation = _implementation;

        super.initialize(_baseOperators, _raiseOperators);
    }

    /**
     * @dev Called by issuer to propose new capital raise.
     * @param _identifier Unique identifier of raise.
     */
    function newRaiseProposal(bytes32 _identifier) public onlyIssuer {
        require(raise[_identifier].issuer == address(0), "RaiseFactory: already exists");

        raise[_identifier].issuer = msg.sender;

        emit NewProposal(msg.sender, _identifier);
    }

    /**
     * @dev Called by operator to accept a capital raise proposal with all of the necessary values for the raise.
     * @param _identifier Unique identifier of raise.
     * @param _accept Whether the operator has accepted.
     * @param _min Minimum amount required in DCHF for the capital raise.
     * @param _max Maximum amount required in DCHF for the capital raise.
     * @param _price DCHF price per share.
     * @param _subscription Minimum amount in DCHF that is required for a subscription.
     * @param _open Opening time in unix epoch time.
     * @param _close Closing time in unix epoch time.
     * @param _token Equity token associated to the capital raise.
     * @return proxy address of raise contract.
     */
    function operatorProposal(
        bytes32 _identifier,
        bool _accept,
        uint256 _min,
        uint256 _max,
        uint256 _price,
        uint256 _subscription,
        uint256 _open,
        uint256 _close,
        address _token
    ) public onlyOperator returns (address proxy) {
        Raise storage info = raise[_identifier];

        require(info.implementation == address(0), "RaiseFactory: already exists");
        require(info.issuer != address(0), "RaiseFactory: issuer not existing");

        if (!_accept) {
            delete raise[_identifier];
            // solhint-disable-next-line not-rely-on-time
            emit ProposalDeclined(info.issuer, _identifier, msg.sender, now);
            return proxy;
        }

        proxy = ProxyDeployer.deployProxy(implementation, proxyAdmin, "");
        RaiseDeployer.initializeRaise(
            proxy,
            dchf,
            info.issuer,
            _min,
            _max,
            _price,
            _subscription,
            _open,
            _close,
            getOperatorsContract(),
            getRaiseOperatorsContract()
        );

        raise[_identifier].token = _token;
        raise[_identifier].implementation = implementation;
        raise[_identifier].proxy = proxy;

        emit ProposalAccepted(info.issuer, _identifier, info.implementation, info.proxy, info.token);
    }

    /**
     * @dev Update the raise implementation address used when deploying proxy contracts
     * @param _implementation Address of the raise implementation contract address.
     */
    function updateImplementation(address _implementation) public onlyOperator {
        implementation = _implementation;
        emit UpdatedImplementation(_implementation);
    }

    /**
     * @dev Update the proxy admin address used when deploying proxy contracts
     * @param _proxyAdmin Address of the default proxy admin address.
     */
    function updateProxyAdmin(address _proxyAdmin) public {
        require(msg.sender == proxyAdmin, "RaiseFactory: caller not proxy admin");
        proxyAdmin = _proxyAdmin;
        emit UpdatedProxyAdmin(proxyAdmin);
    }

    /**
     * @param _identifier Unique identifier of raise.
     * @return whether a implementation has been associated to a raise identifier
     */
    function implementationExists(bytes32 _identifier) public view returns (bool) {
        return (raise[_identifier].implementation != address(0));
    }

    /**
     * @param _identifier Unique identifier of raise.
     * @return implementation and proxy address
     */
    function getImplementationAndProxy(bytes32 _identifier) public view returns (address, address) {
        return (raise[_identifier].implementation, raise[_identifier].proxy);
    }

    /**
     * @param _identifier Unique identifier of raise.
     * @return token associated to capital raise identifier
     */
    function getToken(bytes32 _identifier) public view returns (address) {
        return raise[_identifier].token;
    }

    /**
     * @param _identifier Unique identifier of raise.
     * @return issuer associated to a capital raise identifier
     */
    function getIssuer(bytes32 _identifier) public view returns (address) {
        return raise[_identifier].issuer;
    }
}
