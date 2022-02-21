// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";


contract FractionalizeNFT is ERC721Holder, Ownable {

    uint private MIN_WITHDRAW_AMOUNT_WEI = 50000000000000000;

    struct TokenUI {
        address owner;
        address tokenContract;
        uint tokenId;
        uint fractionsTotalSupply;
        uint availableFractions;
        uint weiPricePerToken;
        address fractionsContract;
        uint uniqueTokenId;
        bool forSale;
        bool soldOut;
    }

    struct UserNFTUI {
        bool fractionalized;
        TokenUI token;
    }

    struct BoughtFractionUI {
        uint amount;
        TokenUI token;
    }

    struct TokenLink {
        address owner;
        uint uniqueTokenId;
    }

    struct Token {
        bool initialized;
        address tokenContract;
        uint tokenId;
        bool fractionalized;
        ERC20Burnable fractionsContract;
        uint weiPricePerToken;
        bool forSale;
        bool soldOut;

        TokenLink prev;
        TokenLink next;
    }

    mapping(address => mapping(uint => Token)) private usersTokens;
    mapping(uint => address) private uniqueTokenIdToOwner;
    mapping(address => uint) private usersBalances;
    mapping(address => uint) private userNFTsCount;
    uint private tokensForSaleCount;
    
    TokenLink private usersTokensTail;


    modifier onlyIfSenderToken(uint _uniqueTokenId) {
        require(usersTokens[msg.sender][_uniqueTokenId].initialized == true, "You dont own this token.");
        _;
    }

    modifier onlyIfTokenFound(uint _uniqueTokenId) {
        require(uniqueTokenIdToOwner[_uniqueTokenId] != address(0), "Token not found.");
        _;
    }

    function deposit(address _tokenContract, uint _tokenId) external {
        _deposit(_tokenContract, _tokenId);
    }

    function _deposit(address _tokenContract, uint _tokenId) private {
        IERC721(_tokenContract).safeTransferFrom(msg.sender, address(this), _tokenId, abi.encodePacked(_tokenContract));

        uint uniqueTokenId = getUniqueTokenId(_tokenContract, _tokenId);

        Token memory token;
        token.initialized = true;
        token.tokenContract = _tokenContract;
        token.tokenId = _tokenId;
        token.fractionalized = false;

        storeUserToken(token, msg.sender, uniqueTokenId);

        userNFTsCount[msg.sender]++;
    }

    function fractionalize(uint _uniqueTokenId, uint _supply, string calldata _name, string calldata _symbol) external {
        _fractionalize(_uniqueTokenId, _supply, _name, _symbol);
    }

    function _fractionalize(uint _uniqueTokenId, uint _supply, string calldata _name, 
        string calldata _symbol) private onlyIfSenderToken(_uniqueTokenId) {

            Token storage token = usersTokens[msg.sender][_uniqueTokenId];
            
            require(token.fractionalized == false, "Token is already fractionalized.");
            
            token.fractionsContract = new ERC20PresetFixedSupply(_name, _symbol, _supply, address(this));
            token.fractionalized = true;
    }

    function sell(uint _uniqueTokenId, uint _weiPrice) external {
        _sell(_uniqueTokenId, _weiPrice);
    }

    function _sell(uint _uniqueTokenId, uint _weiPrice) private onlyIfSenderToken(_uniqueTokenId) {
        Token storage token = usersTokens[msg.sender][_uniqueTokenId];

        require(token.fractionalized == true, "Token is not fractionalized.");
        require(token.forSale == false, "Token is already for sale.");
        require(token.soldOut == false, "Token is already sold out.");

        token.weiPricePerToken = _weiPrice;
        token.forSale = true;

        tokensForSaleCount++;
    }

    function fractionalizeSell(uint _uniqueTokenId, uint _supply, string calldata _name, string calldata _symbol, uint _weiPrice) external {
            _fractionalize(_uniqueTokenId, _supply, _name, _symbol);
            _sell(_uniqueTokenId, _weiPrice);
    }

    function depositFractionalizeSell(address _tokenContract, uint _tokenId, uint _supply, string calldata _name, 
        string calldata _symbol, uint _weiPrice) external {
            _deposit(_tokenContract, _tokenId);
            uint _uniqueTokenId = getUniqueTokenId(_tokenContract, _tokenId);
            _fractionalize(_uniqueTokenId, _supply, _name, _symbol);
            _sell(_uniqueTokenId, _weiPrice);
    }

    function buy(uint _uniqueTokenId, uint _amount) external payable onlyIfTokenFound(_uniqueTokenId) {
        require(usersTokens[msg.sender][_uniqueTokenId].initialized == false, "You cannot buy your own fractions.");

        address sellerAddress = uniqueTokenIdToOwner[_uniqueTokenId];
        Token storage token = usersTokens[sellerAddress][_uniqueTokenId];

        require(msg.value >= token.weiPricePerToken * _amount, "Insufficient wei.");

        usersBalances[sellerAddress] += msg.value;
        token.fractionsContract.transfer(msg.sender, _amount);
 
        if (token.fractionsContract.balanceOf(address(this)) == 0) {
            token.soldOut = true;
            token.forSale = false;

            tokensForSaleCount--;
        }
    }

    function getUserProfit() external view returns(uint) {
        return usersBalances[msg.sender];
    }

    function withdrawSalesProfit() external {
        uint userBalance = usersBalances[msg.sender];
        require(userBalance >= MIN_WITHDRAW_AMOUNT_WEI, "You have less than minimal required funds to withdraw.");
        
        delete usersBalances[msg.sender];

        payable(msg.sender).transfer(userBalance);
    }

    function buyBackNFT(uint _uniqueTokenId) external onlyIfTokenFound(_uniqueTokenId) {
        address owner = uniqueTokenIdToOwner[_uniqueTokenId];
        Token storage token = usersTokens[owner][_uniqueTokenId];
        
        uint totalSupply = token.fractionsContract.totalSupply();
        require(token.fractionsContract.balanceOf(msg.sender) == totalSupply, "You dont own all fractions.");
        
        address tokenContract = token.tokenContract;
        uint tokenId = token.tokenId;

        deleteUserToken(owner, _uniqueTokenId);

        userNFTsCount[owner]--;

        IERC721(tokenContract).transferFrom(address(this), msg.sender, tokenId);
    }

    function getMinWithdrawWeiAmount() external view returns(uint) {
        return MIN_WITHDRAW_AMOUNT_WEI;
    }

    function setMinWithdrawWeiAmount(uint _amount) external onlyOwner() {
        MIN_WITHDRAW_AMOUNT_WEI = _amount;
    }

    function getAllNFTsForSale() external view returns(TokenUI[] memory) {
        if (tokensForSaleCount == 0) {
            return new TokenUI[](0);
        }

        TokenUI[] memory tokens = new TokenUI[](tokensForSaleCount);

        TokenLink memory usersTokensIterator = usersTokensTail;
        
        uint i = 0;

        while (usersTokensIterator.owner != address(0)) {
            Token storage token = usersTokens[usersTokensIterator.owner][usersTokensIterator.uniqueTokenId];

            if (token.forSale == true) {
                tokens[i] = tokenToTokenUI(token, usersTokensIterator.uniqueTokenId, usersTokensIterator.owner);
                i++;
            }

            usersTokensIterator = token.prev;
        }

        return tokens;
    }

    function getUserNFTs() external view returns(UserNFTUI[] memory) {        
        UserNFTUI[] memory userNFTsUI = new UserNFTUI[](userNFTsCount[msg.sender]);

        TokenLink memory usersTokensIterator = usersTokensTail;
        
        uint i = 0;

        while (usersTokensIterator.owner != address(0)) {
            Token storage token = usersTokens[usersTokensIterator.owner][usersTokensIterator.uniqueTokenId];
            
            if (usersTokensIterator.owner == msg.sender) {
                userNFTsUI[i].fractionalized = token.fractionalized;
                userNFTsUI[i].token = tokenToTokenUI(token, usersTokensIterator.uniqueTokenId, usersTokensIterator.owner);
                i++;
            }

            usersTokensIterator = token.prev;
        }

        return userNFTsUI;
    }

    function getUserBoughtFractions() external view returns(BoughtFractionUI[] memory) {
        TokenLink memory usersTokensIterator = usersTokensTail;
        
        uint count = 0;

        while (usersTokensIterator.owner != address(0)) {
            Token storage token = usersTokens[usersTokensIterator.owner][usersTokensIterator.uniqueTokenId];

            if (address(token.fractionsContract) != address(0) && token.fractionsContract.balanceOf(msg.sender) > 0) {
                count++;
            }
            
            usersTokensIterator = token.prev;
        }

        if (count == 0) {
            return new BoughtFractionUI[](0);
        }

        BoughtFractionUI[] memory boughtFractions = new BoughtFractionUI[](count);

        uint i = 0;

        usersTokensIterator = usersTokensTail;

        while (usersTokensIterator.owner != address(0)) {
            Token storage token = usersTokens[usersTokensIterator.owner][usersTokensIterator.uniqueTokenId];
            
            if (address(token.fractionsContract) != address(0)) {
                uint balance = token.fractionsContract.balanceOf(msg.sender);

                if (balance > 0 && i < count) {
                    boughtFractions[i].amount = balance;
                    boughtFractions[i].token = tokenToTokenUI(token, usersTokensIterator.uniqueTokenId, usersTokensIterator.owner);
                    i++;
                }
            }
            
            usersTokensIterator = token.prev;
        }


        return boughtFractions;
    }

    function getUniqueTokenId(address _tokenContract, uint _tokenId) public pure returns(uint) {
        return uint(keccak256(abi.encodePacked(_tokenContract, " ", _tokenId)));
    }

    function storeUserToken(Token memory _token, address _owner, uint _uniqueTokenId) internal {
        _token.prev = usersTokensTail;

        if (_token.prev.owner != address(0)) {
            Token storage prevToken = usersTokens[_token.prev.owner][_token.prev.uniqueTokenId];
            prevToken.next.owner = _owner;
            prevToken.next.uniqueTokenId = _uniqueTokenId;
        }

        usersTokensTail.owner = _owner;
        usersTokensTail.uniqueTokenId = _uniqueTokenId;

        usersTokens[_owner][_uniqueTokenId] = _token;
        uniqueTokenIdToOwner[_uniqueTokenId] = _owner;
    }

    function deleteUserToken(address _owner, uint _uniqueTokenId) internal {
        Token storage token = usersTokens[_owner][_uniqueTokenId];

        if (token.prev.owner != address(0)) {
            Token storage prevToken = usersTokens[token.prev.owner][token.prev.uniqueTokenId];
            prevToken.next = token.next;
        }

        if (token.next.owner != address(0)) {
            Token storage nextToken = usersTokens[token.next.owner][token.next.uniqueTokenId];
            nextToken.prev = token.prev;
        }

        if (_owner == usersTokensTail.owner && _uniqueTokenId == usersTokensTail.uniqueTokenId) {
            usersTokensTail = token.prev;
        }

        token.fractionsContract.burnFrom(msg.sender, token.fractionsContract.totalSupply());

        delete uniqueTokenIdToOwner[_uniqueTokenId];
        delete usersTokens[_owner][_uniqueTokenId];
    }

    function tokenToTokenUI(Token storage _token, uint _uniqueTokenId, address _owner) private view returns(TokenUI memory) {
        TokenUI memory tokenUI;

        tokenUI.tokenContract = _token.tokenContract;
        tokenUI.owner = _owner;
        tokenUI.tokenId = _token.tokenId;

        if (_token.fractionalized == true) {
            tokenUI.fractionsTotalSupply = _token.fractionsContract.totalSupply();
            tokenUI.availableFractions = _token.fractionsContract.balanceOf(address(this));
            tokenUI.fractionsContract = address(_token.fractionsContract);
        } else {
            tokenUI.fractionsTotalSupply = 0;
            tokenUI.availableFractions = 0;
        }

        tokenUI.weiPricePerToken = _token.weiPricePerToken;
        tokenUI.uniqueTokenId = _uniqueTokenId;
        tokenUI.forSale = _token.forSale;
        tokenUI.soldOut = _token.soldOut;

        return tokenUI;
    }
}