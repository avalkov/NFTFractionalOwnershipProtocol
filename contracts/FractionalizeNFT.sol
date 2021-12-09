// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import "hardhat/console.sol";


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

        address[] buyers;

        TokenLink prev;
        TokenLink next;
    }

    mapping(address => mapping(uint => Token)) private usersTokens;
    mapping(uint => address) private uniqueTokenIdToOwner;
    mapping(address => uint) private usersBalances;
    mapping(address => TokenLink[]) private userBoughtFractions;
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

        bool isAlreadyBuyer = false;

        for (uint i = 0; i < token.buyers.length; i++) {
            if (token.buyers[i] == msg.sender) {
                isAlreadyBuyer = true;
                break;
            }
        }

        if (isAlreadyBuyer == false) {
            token.buyers.push(msg.sender);

            storeUserBoughtFraction(sellerAddress, _uniqueTokenId);
        }
 
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
        
        payable(msg.sender).transfer(userBalance);

        delete usersBalances[msg.sender];
    }

    function buyBackNFT(uint _uniqueTokenId) external onlyIfTokenFound(_uniqueTokenId) {
        address owner = uniqueTokenIdToOwner[_uniqueTokenId];
        Token storage token = usersTokens[owner][_uniqueTokenId];
        
        uint totalSupply = token.fractionsContract.totalSupply();
        require(token.fractionsContract.balanceOf(msg.sender) == totalSupply, "You dont own all fractions.");

        IERC721(token.tokenContract).transferFrom(address(this), msg.sender, token.tokenId);

        deleteUserToken(owner, _uniqueTokenId);

        userNFTsCount[owner]--;
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
        TokenLink[] storage fractionsLinks = userBoughtFractions[msg.sender];

        uint len = fractionsLinks.length;

        if (len == 0) {
            return new BoughtFractionUI[](0);
        }

        while (fractionsLinks[len - 1].owner == address(0)) {
            len--;
        }

        BoughtFractionUI[] memory boughtFractions = new BoughtFractionUI[](len);

        for (uint i = 0; i < len; i++) {
            uint uniqueTokenId = fractionsLinks[i].uniqueTokenId;

            Token storage token = usersTokens[fractionsLinks[i].owner][uniqueTokenId];
            
            if (token.fractionalized == true) {
                boughtFractions[i].amount = token.fractionsContract.balanceOf(msg.sender);
            }

            boughtFractions[i].token = tokenToTokenUI(token, uniqueTokenId, fractionsLinks[i].owner);
        }

        return boughtFractions;
    }

    function getUniqueTokenId(address _tokenContract, uint _tokenId) public pure returns(uint) {
        return uint(keccak256(abi.encodePacked(_tokenContract, _tokenId)));
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

        deleteBuyersUserBoughtFractions(token.buyers, _owner, _uniqueTokenId);

        token.fractionsContract.burnFrom(msg.sender, token.fractionsContract.totalSupply());

        delete uniqueTokenIdToOwner[_uniqueTokenId];
        delete usersTokens[_owner][_uniqueTokenId];
    }

    function storeUserBoughtFraction(address _owner, uint _uniqueTokenId) internal {
        uint fractionsLength = userBoughtFractions[msg.sender].length;

        if (fractionsLength == 0) {
            userBoughtFractions[msg.sender].push(TokenLink(_owner, _uniqueTokenId));
            return;
        }

        uint i = fractionsLength - 1;

        while (i > 0 && userBoughtFractions[msg.sender][i].owner == address(0)) {
            i--;
        }

        i++;

        if (i <= fractionsLength - 1 && userBoughtFractions[msg.sender][i].owner == address(0)) {
            userBoughtFractions[msg.sender][i] = TokenLink(_owner, _uniqueTokenId);
            return;
        }

        userBoughtFractions[msg.sender].push(TokenLink(_owner, _uniqueTokenId));
    }

    function deleteBuyersUserBoughtFractions(address[] memory _buyers, address _owner, uint _uniqueTokenId) internal {
        for (uint i = 0; i < _buyers.length; i++) {

            address buyer = _buyers[i];

            uint length = userBoughtFractions[buyer].length;

            for (uint j = 0; j < length; j++) {

                if (userBoughtFractions[buyer][j].owner == _owner && userBoughtFractions[buyer][j].uniqueTokenId == _uniqueTokenId) {

                    delete userBoughtFractions[buyer][j];

                    if (length == 1) {
                        // The only one entry of the array was deleted
                        delete userBoughtFractions[buyer];
                        break;
                    }

                    // Find last non empty entry
                    uint x = length - 1;

                    while (x > j && userBoughtFractions[buyer][x].owner == address(0)) {
                        x--;
                    }

                    if (x == j) {
                        // No non-empty entry was found
                        
                        if (j == 0) {
                            // No non-empty entry was found and this is the element at first position in the array
                            delete userBoughtFractions[buyer];
                            break;
                        }

                        break;
                    }
                    
                    userBoughtFractions[buyer][j] = userBoughtFractions[buyer][x];
                    delete userBoughtFractions[buyer][x];
                    break;
                }
            }
        }
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