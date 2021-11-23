const { expect } = require("chai");


describe("FractionalizeNFT-internals-test", function() {
    let fractionalizeNFTFactory;
    let fractionalizeNFT;
    let deployer;

    before(async () => {
        fractionalizeNFTFactory = await ethers.getContractFactory("FractionalizeNFTExposedInternals");
        fractionalizeNFT = await fractionalizeNFTFactory.deploy();
        await fractionalizeNFT.deployed();

        [deployer] = await ethers.getSigners();
    });

    it("Should store and delete single entry from userBoughtFractions", async function() {
        const [_, client1] = await ethers.getSigners();
        await fractionalizeNFT.storeUserBoughtFractionPublic(client1.address, 1234);
        await fractionalizeNFT.deleteBuyersUserBoughtFractionsPublic([deployer.address], client1.address, 1234);
        const userBoughtFractions = await fractionalizeNFT.getUserBoughtFractions();
        expect(userBoughtFractions.length).to.be.equal(0);
    });

    it("Should store three entries in userBoughtFractions, delete two of them and store two new entries in the empty slots of the deleted ones", async function() {
        const [_, client1, client2, client3] = await ethers.getSigners();

        await fractionalizeNFT.storeUserBoughtFractionPublic(client1.address, 1234);
        await fractionalizeNFT.storeUserBoughtFractionPublic(client2.address, 12345);
        await fractionalizeNFT.storeUserBoughtFractionPublic(client3.address, 123456);

        await fractionalizeNFT.deleteBuyersUserBoughtFractionsPublic([deployer.address], client3.address, 123456);
        await fractionalizeNFT.deleteBuyersUserBoughtFractionsPublic([deployer.address], client1.address, 1234);

        await fractionalizeNFT.storeUserBoughtFractionPublic(client1.address, 2222);
        await fractionalizeNFT.storeUserBoughtFractionPublic(client3.address, 3333);

        const userBoughtFractions = await fractionalizeNFT.getUserBoughtFractions();
        expect(userBoughtFractions.length).to.be.equal(3);
    });
});