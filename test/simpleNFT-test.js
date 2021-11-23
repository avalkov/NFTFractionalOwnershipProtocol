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

    it("Should mint NFT", async function () {
        expect(await simpleNFT.mint(deployer.address, 1, "http://somenft.com/image.jpeg"))
            .to.emit(simpleNFT, "Transfer")
            .withArgs("0x" + '0'.repeat(40), deployer.address, 1);
    });

    it("Should return token uri when only token uri is set", async function() {
        await simpleNFT.mint(deployer.address, 2, "http://somenft.com/image.jpeg");
        expect(await simpleNFT.tokenURI(2)).to.equal("http://somenft.com/image.jpeg");
    });

    it("Should return base uri + token uri when base uri and token uri are set", async function() {
        await simpleNFT.setBaseURI("http://somenft.com/");
        await simpleNFT.mint(deployer.address, 3, "image.jpeg");
        expect(await simpleNFT.tokenURI(3)).to.equal("http://somenft.com/image.jpeg");
    });

    it("Should return base uri + token id when only base uri is set", async function() {
        await simpleNFT.setBaseURI("http://somenft.com/");
        await simpleNFT.mint(deployer.address, 4, "");
        expect(await simpleNFT.tokenURI(4)).to.equal("http://somenft.com/4");
    });

    it("Should fail to set base uri for non-owners", async function() {
        const [_, addr1] = await ethers.getSigners();
        await expect(simpleNFT.connect(addr1).setBaseURI("http://somenft.com/")).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail to mint for non-owners", async function() {
        const [_, addr1] = await ethers.getSigners();
        await expect(simpleNFT.connect(addr1).mint(addr1.address, 5, "")).to.be.revertedWith("Ownable: caller is not the owner")
    });

    it("Should fail to return token uri for non existent token id", async function() {
        await expect(simpleNFT.tokenURI(6)).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");
    });

    it("Should fail to set token uri for non existing token id", async function() {
        await expect(simpleNFT.setTokenURI(21, "http://somenft.com/")).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });
});