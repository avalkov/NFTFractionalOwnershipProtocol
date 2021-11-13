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
        bool soldOut;
    }

    mapping(address => mapping(uint => Token)) usersTokens;
    mapping(uint => address) tokensForSale;
    mapping(uint => bool) depositedTokens;
    mapping(address => uint) usersBalances;

    event TokenDeposited(address _from, uint _tokenId, uint _uniqueTokenId);

    modifier onlyIfSenderToken(uint _uniqueTokenId) {
        require(usersTokens[msg.sender][_uniqueTokenId].initialized == true, "Token not found.");
        _;
    }

    function deposit(address _tokenContract, uint _tokenId) external {
        IERC721(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenId, abi.encodePacked(msg.sender));
    }

    function fractionalize(uint _uniqueTokenId, uint _supply, string calldata _name, string calldata _symbol) external onlyIfSenderToken(_uniqueTokenId) {
        Token storage token = usersTokens[msg.sender][_uniqueTokenId];
        
        require(token.fractionalized == false, "Token is already fractionalized.");
        
        token.fractionsContract = new ERC20PresetFixedSupply(_name, _symbol, _supply, address(this));
        token.fractionalized = true;
    }

    function sell(uint _uniqueTokenId, uint _weiPrice) external onlyIfSenderToken(_uniqueTokenId) {
        Token storage token = usersTokens[msg.sender][_uniqueTokenId];

        require(token.fractionalized == true, "Token is not fractionalized.");
        require(tokensForSale[_uniqueTokenId] == address(0), "Token is already for sale.");
        require(token.soldOut == false, "Token is already sold out.");

        token.weiPricePerToken = _weiPrice;
        tokensForSale[_uniqueTokenId] = msg.sender;
    }

    function depositFractionalizeSell(address _tokenContract, uint _tokenId, uint _supply, string calldata _name, 
        string calldata _symbol, uint _weiPrice) external {

    }

    function buy(uint _uniqueTokenId, uint _amount) external payable {
        require(usersTokens[msg.sender][_uniqueTokenId].initialized == false, "You cannot buy your own fractions.");

        address sellerAddress = tokensForSale[_uniqueTokenId];
        require(sellerAddress != address(0), "Token is not for sale.");

        Token storage token = usersTokens[sellerAddress][_uniqueTokenId];
        require(msg.value >= token.weiPricePerToken * _amount, "Insufficient wei.");
        
        usersBalances[sellerAddress] += msg.value;

        token.fractionsContract.transfer(msg.sender, _amount);

        if (token.fractionsContract.balanceOf(address(this)) == 0) {
            token.soldOut = true;
            delete tokensForSale[_uniqueTokenId];
        }
    }

    function getUniqueTokenId(address _tokenContract, uint _tokenId) public pure returns(uint) {
        return uint(keccak256(abi.encodePacked(_tokenContract, _tokenId)));
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
}