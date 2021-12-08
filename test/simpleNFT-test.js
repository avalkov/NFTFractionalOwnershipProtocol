const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("SimpleNFT", function () {
    let simpleNFTFactory;
    let simpleNFT;

    let deployer;

    before(async () => {
        simpleNFTFactory = await ethers.getContractFactory("SimpleNFT");
        simpleNFT = await simpleNFTFactory.deploy("Test Token", "TT");
        await simpleNFT.deployed();

        [deployer] = await ethers.getSigners();
    });

    it("Should mint NFT with selected ID", async function () {
        expect(await simpleNFT.mintWithID(deployer.address, 1, "http://somenft.com/image.jpeg"))
            .to.emit(simpleNFT, "Transfer")
            .withArgs("0x" + '0'.repeat(40), deployer.address, 1);
    });

    it("Should return token uri when only token uri is set", async function() {
        await simpleNFT.mintWithID(deployer.address, 2, "http://somenft.com/image.jpeg");
        expect(await simpleNFT.tokenURI(2)).to.equal("http://somenft.com/image.jpeg");
    });

    it("Should return base uri + token uri when base uri and token uri are set", async function() {
        await simpleNFT.setBaseURI("http://somenft.com/");
        await simpleNFT.mintWithID(deployer.address, 3, "image.jpeg");
        expect(await simpleNFT.tokenURI(3)).to.equal("http://somenft.com/image.jpeg");
    });

    it("Should return base uri + token id when only base uri is set", async function() {
        await simpleNFT.setBaseURI("http://somenft.com/");
        await simpleNFT.mintWithID(deployer.address, 4, "");
        expect(await simpleNFT.tokenURI(4)).to.equal("http://somenft.com/4");
    });

    it("Should fail to return token uri for non existent token id", async function() {
        await expect(simpleNFT.tokenURI(6)).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");
    });

    it("Should fail to set token uri for non existing token id", async function() {
        await expect(simpleNFT.setTokenURI(21, "http://somenft.com/")).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("Should mint NFT without selected ID", async function () {
        expect(await simpleNFT.mint(deployer.address, "http://somenft.com/image.jpeg"))
            .to.emit(simpleNFT, "Transfer")
            .withArgs("0x" + '0'.repeat(40), deployer.address, 5);
    });

    it("Should return user token ids", async function() {
        const tokenIds = await simpleNFT.getTokenIds();
        const expectedValues = ["1", "2", "3", "4", "5"];

        for (let i = 0; i < tokenIds.length; ++i) {
            expect(tokenIds[i].toString()).to.equal(expectedValues[i]);
        }
    });

    it("Should check supported interfaces", async function() {
        const _InterfaceId_ERC721 = 0x80ac58cd;
        expect(await simpleNFT.supportsInterface(_InterfaceId_ERC721)).to.be.equal(true);
    });
});