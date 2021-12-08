// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";


contract SimpleNFT is ERC721, ERC721Enumerable {
    
    using Strings for uint256;
    
    mapping (uint256 => string) private tokenURIs;
    uint private tokenId = 1;
    string private _baseURIextended;

    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol) {

    }
    
    function _beforeTokenTransfer(address from, address to, uint256 _tokenId) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, _tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setTokenURI(uint256 _tokenId, string memory _tokenURI) external {
        _setTokenURI(_tokenId, _tokenURI);
    }

    function setBaseURI(string memory baseURI_) external {
        _baseURIextended = baseURI_;
    }
    
    function _setTokenURI(uint256 _tokenId, string memory _tokenURI) internal virtual {
        require(_exists(_tokenId), "ERC721Metadata: URI set of nonexistent token");
        tokenURIs[_tokenId] = _tokenURI;
    }
    
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIextended;
    }
    
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory _tokenURI = tokenURIs[_tokenId];
        string memory base = _baseURI();
        
        if (bytes(base).length == 0) {
            return _tokenURI;
        }

        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return string(abi.encodePacked(base, _tokenId.toString()));
    }

    function mintWithID(address _to, uint256 _tokenId, string memory _tokenURI) external {
        _mint(_to, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
    }

    function mint(address _to, string memory _tokenURI) external {
        while(_exists(tokenId)) {
            tokenId++;
        }

        _mint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        tokenId++;
    }

    function getTokenIds() public view returns (uint[] memory) {
        uint[] memory tokensOfOwner = new uint[](ERC721.balanceOf(msg.sender));

        for (uint i = 0; i < ERC721.balanceOf(msg.sender); i++) {
            tokensOfOwner[i] = ERC721Enumerable.tokenOfOwnerByIndex(msg.sender, i);
        }

        return tokensOfOwner;
    }
}