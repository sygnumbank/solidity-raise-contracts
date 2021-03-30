/**
 * @title CappedRaise
 * @author Team 3301 <team3301@sygnum.com>
 * @dev Stores, and modified amount of shares that have been sold.  This also implements total amount available to be sold limitations.
 */

pragma solidity 0.5.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract CappedRaise {
    using SafeMath for uint256;

    uint256 private minCap;
    uint256 private maxCap;
    uint256 private sold;
    address[] private receivers;

    mapping(address => uint256) private shares;

    /**
     * @dev Sets the minimum and maximum cap for the capital raise.
     * @param _minCap uint256 minimum cap.
     * @param _maxCap uint256 maximum cap.
     */
    function _setCap(uint256 _minCap, uint256 _maxCap) internal {
        require(_minCap > 0, "CappedRaise: minimum cap must exceed zero");
        require(_maxCap > _minCap, "CappedRaise: maximum cap must exceed minimum cap");
        minCap = _minCap;
        maxCap = _maxCap;
    }

    /**
     * @dev updates the total that the capital raise has sold and the relevant user shares balance.
     * @param _receiver address Receiving address.
     * @param _shares uint256 Amount of shares.
     */
    function _updateSold(address _receiver, uint256 _shares) internal {
        shares[_receiver] = shares[_receiver].add(_shares);
        sold = sold.add(_shares);

        receivers.push(_receiver);
    }

    /**
     * @return the max cap of the raise.
     */
    function getMaxCap() public view returns (uint256) {
        return maxCap;
    }

    /**
     * @return the min cap of the raise.
     */
    function getMinCap() public view returns (uint256) {
        return minCap;
    }

    /**
     * @return the sold amount of the raise.
     */
    function getSold() public view returns (uint256) {
        return sold;
    }

    /**
     * @return the length of receivers.
     */
    function getReceiversLength() public view returns (uint256) {
        return receivers.length;
    }

    /**
     * @param _index uint256 index of the receiver.
     * @return receiver address at index.
     */
    function getReceiver(uint256 _index) public view returns (address) {
        return receivers[_index];
    }

    /**
     * @dev returns sub-array of receivers for a given range of indices
     * @param _start uint256 start index
     * @param _end uint256 end index
     * @return address[] sub-array of receivers' addresses
     */
    function getReceiversBatch(uint256 _start, uint256 _end) public view returns (address[] memory) {
        require(_start < _end, "CappedRaise: Wrong receivers array indices");
        require(_end.sub(_start) <= 256, "CappedRaise: Greater than block limit");
        address[] memory _receivers = new address[](_end.sub(_start));
        for (uint256 _i = 0; _i < _end.sub(_start); _i++) {
            _receivers[_i] = _i.add(_start) < receivers.length ? receivers[_i.add(_start)] : address(0);
        }
        return _receivers;
    }

    /**
     * @return the available shares of raise (shares that are not sold yet).
     */
    function getAvailableShares() public view returns (uint256) {
        return maxCap.sub(sold);
    }

    /**
     * @param _receiver address Receiving address.
     * @return the receiver's shares.
     */
    function getShares(address _receiver) public view returns (uint256) {
        return shares[_receiver];
    }

    /**
     * @dev Checks whether the max cap has been reached.
     * @return Whether the max cap has been reached.
     */
    function maxCapReached() public view returns (bool) {
        return sold >= maxCap;
    }

    /**
     * @dev Checks whether the min cap has been reached.
     * @return Whether the min cap has been reached.
     */
    function minCapReached() public view returns (bool) {
        return sold >= minCap;
    }
}
