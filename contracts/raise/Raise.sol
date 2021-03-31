/**
 * @title Raise
 * @author Team 3301 <team3301@sygnum.com>
 * @dev The Raise contract acts as an escrow for subscriptions, and issuer payments.
 *       This contract also has a cap upon how much can be purchased, and time boundaries implemented.
 *       Contract is spawned from RaiseFactory.
 */

pragma solidity 0.5.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@sygnum/solidity-base-contracts/contracts/helpers/Pausable.sol";
import "@sygnum/solidity-base-contracts/contracts/role/raise/RaiseOperatorable.sol";

import "./CappedRaise.sol";
import "./TimedRaise.sol";
import "../libraries/Bytes32Set.sol";

contract Raise is RaiseOperatorable, CappedRaise, TimedRaise, Pausable {
    using SafeMath for uint256;
    using Bytes32Set for Bytes32Set.Set;

    IERC20 public dchf;
    address public issuer;
    uint256 public price;
    uint256 public minSubscription;
    uint256 public totalPendingDeposits;
    uint256 public totalDeclinedDeposits;
    uint256 public totalAcceptedDeposits;
    bool public issuerPaid;

    mapping(bytes32 => Subscription) public subscription;
    mapping(bool => Bytes32Set.Set) internal subscriptions;
    mapping(address => mapping(bool => Bytes32Set.Set)) internal investor;

    Stage public stage;
    enum Stage {Created, RepayAll, IssuerAccepted, OperatorAccepted, Closed}

    struct Subscription {
        address investor;
        uint256 shares;
        uint256 cost;
    }

    uint16 internal constant BATCH_LIMIT = 256;

    event SubscriptionProposal(address indexed issuer, address indexed investor, bytes32 subID);
    event SubscriptionAccepted(address indexed payee, bytes32 subID, uint256 shares, uint256 cost);
    event SubscriptionDeclined(address indexed payee, bytes32 subID, uint256 cost);
    event RaiseClosed(address indexed issuer, bool accepted);
    event OperatorRaiseFinalization(address indexed issuer, bool accepted);
    event IssuerPaid(address indexed issuer, uint256 amount);
    event OperatorClosed(address indexed operator);
    event UnsuccessfulRaise(address indexed issuer);
    event ReleasedPending(address indexed investor, uint256 amount);
    event ReleasedEmergency(address indexed investor, uint256 amount);

    /**
     * @dev Reverts if caller is not the issuer.
     */
    modifier onlyIssuer() {
        require(msg.sender == issuer, "Raise: caller not issuer");
        _;
    }

    /**
     * @dev Reverts if the current stage is not the specified stage.
     */
    modifier onlyAtStage(Stage _stage) {
        require(stage == _stage, "Raise: not at correct stage");
        _;
    }

    /**
     * @dev Initialization instead of constructor, called once to initialize all the necessary values.
     * @param _dchf DCHF proxy contract address.
     * @param _issuer Address of capital raise issuer.
     * @param _min Minimum amount required in DCHF for the capital raise.
     * @param _max Maximum amount required in DCHF for the capital raise.
     * @param _price DCHF price per share.
     * @param _minSubscription Minimum amount in DCHF that is required for a subscription.
     * @param _open Opening time in unix epoch time.
     * @param _close Closing time in unix epoch time.
     * @param _baseOperators BaseOperators contract address.
     * @param _raiseOperators RaiseOperators contract address.
     */
    function initialize(
        IERC20 _dchf,
        address _issuer,
        uint256 _min,
        uint256 _max,
        uint256 _price,
        uint256 _minSubscription,
        uint256 _open,
        uint256 _close,
        address _baseOperators,
        address _raiseOperators
    ) public initializer {
        dchf = _dchf;
        price = _price;
        issuer = _issuer;
        _setCap(_min, _max);
        _setTime(_open, _close);
        minSubscription = _minSubscription;
        RaiseOperatorable.initialize(_baseOperators, _raiseOperators);
    }

    /**
     * @dev Investor can subscribe to the capital raise with the unique subscription hash.
     * @param _subID Subscription unique identifier
     * @param _shares Amount of shares to purchase.
     */
    function subscribe(bytes32 _subID, uint256 _shares)
        public
        whenNotPaused
        onlyInvestor
        onlyAtStage(Stage.Created)
        onlyWhileOpen
    {
        require(_shares <= getAvailableShares(), "Raise: above available");

        uint256 cost = _shares.mul(price);

        require(cost >= minSubscription, "Raise: below minimum subscription");
        require(cost <= dchf.allowance(msg.sender, address(this)), "Raise: above allowance");

        dchf.transferFrom(msg.sender, address(this), cost);
        totalPendingDeposits = totalPendingDeposits.add(cost);

        investor[msg.sender][false].insert(_subID);
        subscriptions[false].insert(_subID);
        subscription[_subID] = Subscription({investor: msg.sender, shares: _shares, cost: cost});

        emit SubscriptionProposal(issuer, msg.sender, _subID);
    }

    /**
     * @dev Issuer accept or decline subscription.
     * @param _subID Subscription unique identifier
     * @param _accept Whether acceptance or not.
     */
    function issuerSubscription(bytes32 _subID, bool _accept)
        public
        whenNotPaused
        onlyIssuer
        onlyAtStage(Stage.Created)
    {
        require(subscriptions[false].exists(_subID), "Raise: subscription does not exist");
        require(!maxCapReached(), "Raise: max sold already met");

        Subscription memory sub = subscription[_subID];

        totalPendingDeposits = totalPendingDeposits.sub(sub.cost);

        if (!_accept || getAvailableShares() < sub.shares) {
            subscriptions[false].remove(_subID);
            investor[sub.investor][false].remove(_subID);
            totalDeclinedDeposits = totalDeclinedDeposits.add(sub.cost);
            delete subscription[_subID];
            dchf.transfer(sub.investor, sub.cost);
            emit SubscriptionDeclined(sub.investor, _subID, sub.cost);
            return;
        }

        subscriptions[false].remove(_subID);
        subscriptions[true].insert(_subID);
        investor[sub.investor][false].remove(_subID);
        investor[sub.investor][true].insert(_subID);
        _updateSold(sub.investor, sub.shares);
        // no reentrancy possibility here, only transferring to dchf, not arbitrary address
        // solhint-disable-next-line reentrancy
        totalAcceptedDeposits = totalAcceptedDeposits.add(sub.cost);
        emit SubscriptionAccepted(sub.investor, _subID, sub.shares, sub.cost);
    }

    /**
     * @dev Issuer closes the capital raise.
     * @param _accept Whether acceptance or not of the capital raise.
     */
    function issuerClose(bool _accept) public whenNotPaused onlyIssuer onlyAtStage(Stage.Created) {
        if (!minCapReached() && hasClosed()) {
            stage = Stage.RepayAll;
            emit UnsuccessfulRaise(msg.sender);
        } else if ((minCapReached() && hasClosed()) || maxCapReached()) {
            stage = _accept ? Stage.IssuerAccepted : Stage.RepayAll;
            emit RaiseClosed(msg.sender, _accept);
        }
    }

    /**
     * @dev Operator finalize capital raise after issuer has accepted.
     * @param _accept Whether acceptance or not of the capital raise.
     */
    function operatorFinalize(bool _accept) public whenNotPaused onlyOperator {
        if (_accept) {
            require(stage == Stage.IssuerAccepted, "Raise: incorrect stage");
            stage = Stage.OperatorAccepted;
        } else {
            require(stage != Stage.OperatorAccepted && stage != Stage.Closed, "Raise: incorrect stage");
            stage = Stage.RepayAll;
        }
        emit OperatorRaiseFinalization(msg.sender, _accept);
    }

    /**
     * @dev Release DCHF obtained to issuer.
     */
    function releaseToIssuer() public whenNotPaused onlyOperatorOrSystem onlyAtStage(Stage.OperatorAccepted) {
        require(!issuerPaid, "Raise: issuer already paid");
        issuerPaid = true;

        dchf.transfer(issuer, totalAcceptedDeposits);

        emit IssuerPaid(issuer, totalAcceptedDeposits);
    }

    /**
     * @dev Release pending DCHF subscriptions.
     * @param _investors Array of investors to release pending subscriptions for.
     */
    function batchReleasePending(address[] memory _investors) public whenNotPaused onlyOperatorOrSystem {
        require(_investors.length <= BATCH_LIMIT, "Raise: batch count is greater than BATCH_LIMIT");
        require(stage != Stage.Created, "Raise: not at correct stage");
        for (uint256 i = 0; i < _investors.length; i++) {
            address user = _investors[i];
            uint256 amount = _clearInvestorFunds(user, false);
            dchf.transfer(user, amount);
            emit ReleasedPending(user, amount);
        }
    }

    /**
     * @dev Close the capital raise after either pending participants have been paid back, or all participants have been repaid.
     */
    function close() public whenNotPaused onlyOperatorOrSystem onlyWhenClosed {
        require(stage == Stage.OperatorAccepted || stage == Stage.RepayAll, "Raise: not at correct stage");
        require(subscriptions[false].count() == 0, "Raise: pending not emptied");

        if (stage == Stage.OperatorAccepted) require(issuerPaid, "Raise: issuer not been paid");

        if (stage == Stage.RepayAll) require(subscriptions[true].count() == 0, "Raise: not emptied");

        stage = Stage.Closed;
        emit OperatorClosed(msg.sender);
    }

    /**
     * @dev Pay pending and accepted DCHF back to investors.
     * @param _investors Array of investors to repay.
     */
    function releaseAllFunds(address[] memory _investors) public onlyOperatorOrSystem {
        require(Pausable.isPaused() || stage == Stage.RepayAll, "Raise: not at correct stage");

        for (uint256 i = 0; i < _investors.length; i++) {
            address user = _investors[i];
            uint256 amount = _clearInvestorFunds(user, false).add(_clearInvestorFunds(user, true));
            if (amount > 0) {
                dchf.transfer(user, amount);
                emit ReleasedEmergency(user, amount);
            }
        }
    }

    /**
     * @param _accept Pending or accepted.
     * @return Amount of pending/accepted subscriptions.
     */
    function getSubscriptionTypeLength(bool _accept) public view returns (uint256) {
        return (subscriptions[_accept].count());
    }

    /**
     * @param _investor address of investor.
     * @param _accept pending or accepted.
     * @return Subscription IDs per investor for pending or accepted subscriptions.
     */
    function getSubIDs(address _investor, bool _accept) public view returns (bytes32[] memory) {
        bytes32[] memory subIDs = new bytes32[](investor[_investor][_accept].count());
        for (uint256 i = 0; i < investor[_investor][_accept].count(); i++) {
            subIDs[i] = investor[_investor][_accept].keyAtIndex(i);
        }
        return subIDs;
    }

    /**
     * @param _investor address of investor.
     * @param _accept pending or accepted.
     * @return Deposit per investor for pending or accepted subscriptions.
     */
    function getDeposits(address _investor, bool _accept) public view returns (uint256 deposit) {
        bytes32[] memory subIDs = getSubIDs(_investor, _accept);

        for (uint256 i = 0; i < subIDs.length; i++) {
            bytes32 subID = subIDs[i];

            deposit = deposit.add(subscription[subID].cost);
        }
        return deposit;
    }

    function _clearInvestorFunds(address _user, bool _approved) internal returns (uint256) {
        uint256 amount;
        while (investor[_user][_approved].count() != 0) {
            bytes32 subID = investor[_user][_approved].keyAtIndex(0);
            Subscription memory sub = subscription[subID];
            amount = amount.add(sub.cost);
            subscriptions[_approved].remove(subID);
            investor[_user][_approved].remove(subID);
            delete subscription[subID];
        }
        return amount;
    }
}
