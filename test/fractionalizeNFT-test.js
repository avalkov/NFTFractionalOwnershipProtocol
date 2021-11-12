const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("FractionalizeNFT", function() {
    let simpleNFTFactory;
    let simpleNFT;
    let fractionalizeNFTFactory;
    let fractionalizeNFT;
    before(async () => {
        simpleNFTFactory = await ethers.getContractFactory("SimpleNFT");
        simpleNFT = await simpleNFTFactory.deploy("Test Token", "TT");
        await simpleNFT.deployed();

        fractionalizeNFTFactory = await ethers.getContractFactory("FractionalizeNFT");
        fractionalizeNFT = await fractionalizeNFTFactory.deploy();
        await fractionalizeNFT.deployed();
    });

    it("Should successfully deposit NFT", async function() {
        const tokenId = 1;
        const [deployer] = await ethers.getSigners();
        await simpleNFT.mint(deployer.address, tokenId, "image.jpeg");
        simpleNFT.setApprovalForAll(fractionalizeNFT.address, true);
        console.log("simpleNFT address: ", simpleNFT.address);
        expect(await fractionalizeNFT.deposit(simpleNFT.address, tokenId))
            .to.emit(fractionalizeNFT, "TokenDeposited")
            .withArgs(deployer.address, tokenId);
    });
});