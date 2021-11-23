// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./FractionalizeNFT.sol";

contract FractionalizeNFTExposedInternals is FractionalizeNFT {
    function storeUserBoughtFractionPublic(address _owner, uint _uniqueTokenId) external {
        storeUserBoughtFraction(_owner, _uniqueTokenId);
    }

    function deleteBuyersUserBoughtFractionsPublic(address[] calldata _buyers, address _owner, uint _uniqueTokenId) external {
        deleteBuyersUserBoughtFractions(_buyers, _owner, _uniqueTokenId);
    }
}