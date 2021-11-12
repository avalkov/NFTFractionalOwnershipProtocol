// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

import "hardhat/console.sol";


contract FractionalizeNFT is ERC721Holder {

    struct Token {
        bool initialized;
        address tokenContract;
        uint tokenId;
        bool fractionalized;
        ERC20 fractionsContract;
        uint weiPricePerToken;
        bool isSoldOut;
    }

    struct TokenEntry {
        address owner;
        uint uniqueTokenId;
    }

    mapping(address => mapping(uint => Token)) usersTokens;
    mapping(uint => TokenEntry) tokensForSale;
    mapping(uint => bool) depositedTokens;

    event TokenDeposited(address _from, uint _tokenId, uint _uniqueTokenId);

    modifier onlyIfSenderToken(uint _uniqueTokenId) {
        require(usersTokens[msg.sender][_uniqueTokenId].initialized == true, "Token not found.");
        _;
    }

    function deposit(address _tokenContract, uint _tokenId) external {
        IERC721(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenId, abi.encodePacked(_tokenContract));
    }

    function fractionalize(uint _uniqueTokenId, uint _supply, string calldata _name, string calldata _symbol) external onlyIfSenderToken(_uniqueTokenId) {
        require(usersTokens[msg.sender][_uniqueTokenId].fractionalized == false, "Token is already fractionalized.");
        usersTokens[msg.sender][_uniqueTokenId].fractionsContract = new ERC20PresetFixedSupply(_name, _symbol, _supply, address(this));
    }

    function sell(uint _uniqueTokenId, uint _weiPrice) external onlyIfSenderToken(_uniqueTokenId) {
        // Check if token is not already for sale
        // Check if its fractionized,
        // Check if its not already soldOut
    }

    function buy(uint _uniqueTokenId, uint _amount) external {
        // Check if token is NOT initialized for this user
        // Check if token exists in tokensForSale
        // when there is no more supply left, just delete it from tokensForSale and set flag isSoldOut
    }

    function onERC721Received(address _transferInitiator, address _from, uint256 _tokenId, bytes memory data) public virtual override returns (bytes4) {
        require(address(this) == _transferInitiator, "onERC721Received: Deposits allowed only from the fractionalize contract itself.");
        
        address userAddress = bytesToAddress(data);
        uint uniqueTokenId = getUniqueTokenId(userAddress, _tokenId);
        require(depositedTokens[uniqueTokenId] == false, "onERC721Received: The token is already deposited.");

        // TODO: Should be set to false when user, uses all the fractions to buy back the NFT
        depositedTokens[uniqueTokenId] = true;

        Token memory token;
        token.initialized = true;
        token.tokenContract = _from;
        token.tokenId = _tokenId;
        token.fractionalized = false;
        usersTokens[userAddress][uniqueTokenId] = token;

        emit TokenDeposited(_from, _tokenId, uniqueTokenId);

        return this.onERC721Received.selector;
    }

    function bytesToAddress(bytes memory _bys) private pure returns (address addr) {
        assembly {
            addr := mload(add(_bys, 20))
        }
    }

    function getUniqueTokenId(address _tokenContract, uint _tokenId) private pure returns(uint) {
        return uint(keccak256(abi.encodePacked(_tokenContract, _tokenId)));
    }
}