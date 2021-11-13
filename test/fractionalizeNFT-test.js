const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("FractionalizeNFT", function() {
    let simpleNFTFactory;
    let simpleNFT;
    let fractionalizeNFTFactory;
    let fractionalizeNFT;
    let deployer;

    before(async () => {
        simpleNFTFactory = await ethers.getContractFactory("SimpleNFT");
        simpleNFT = await simpleNFTFactory.deploy("Test Token", "TT");
        await simpleNFT.deployed();

        fractionalizeNFTFactory = await ethers.getContractFactory("FractionalizeNFT");
        fractionalizeNFT = await fractionalizeNFTFactory.deploy();
        await fractionalizeNFT.deployed();

        await simpleNFT.setApprovalForAll(fractionalizeNFT.address, true);

        [deployer] = await ethers.getSigners();
    });

    it("Should deposit NFT", async function() {
        const tokenId = 1;
        await simpleNFT.mint(deployer.address, tokenId, "image.jpeg");

        expect(await fractionalizeNFT.deposit(simpleNFT.address, tokenId))
            .to.emit(fractionalizeNFT, "TokenDeposited");
    });

    it("Should fractionalize, deposited NFT", async function() {
        const tokenId = 2;
        await simpleNFT.mint(deployer.address, tokenId, "image.jpeg");
        await fractionalizeNFT.deposit(simpleNFT.address, tokenId);

        let uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(deployer.address, tokenId);
        await fractionalizeNFT.fractionalize(uniqueTokenId, 100, "Test Token", "TT");
    });

    it("Should publish for sale, ERC20 fractions", async function() {
        const tokenId = 3;
        await simpleNFT.mint(deployer.address, tokenId, "image.jpeg");
        await fractionalizeNFT.deposit(simpleNFT.address, tokenId);

        let uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(deployer.address, tokenId);
        await fractionalizeNFT.fractionalize(uniqueTokenId, 100, "Test Token", "TT");
        await fractionalizeNFT.sell(uniqueTokenId, 100000000);
    });

    it("Should buy published for sale ERC20 fractions", async function() {
        const tokenId = 4;
        await simpleNFT.mint(deployer.address, tokenId, "image.jpeg");
        await fractionalizeNFT.deposit(simpleNFT.address, tokenId);

        let uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(deployer.address, tokenId);
        await fractionalizeNFT.fractionalize(uniqueTokenId, 100, "Test Token", "TT");
        await fractionalizeNFT.sell(uniqueTokenId, 100000000);

        const [_, addr1] = await ethers.getSigners();

        await fractionalizeNFT.connect(addr1).buy(uniqueTokenId, 1, {
            value: ethers.utils.parseEther("1.0")
        });
    });
});