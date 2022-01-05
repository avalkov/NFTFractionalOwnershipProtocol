const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("./helpers");
const ERC20 = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json")


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

    async function approveForUserBoughtToken(idx, client) {
        const userBoughtFractions = await fractionalizeNFT.connect(client).getUserBoughtFractions();
        const fractionsContract = await ethers.getContractAt(ERC20.abi, userBoughtFractions[idx].token.fractionsContract, client);
        await fractionsContract.connect(client).increaseAllowance(fractionalizeNFT.address, userBoughtFractions[idx].token.fractionsTotalSupply);
    }

    it("Should buy all ERC20 tokens from first fractionalized NFT and buy it back", async function() {
        const tokenId = 1111;
        const totalSupply = 100;
        const availableSupply = 100;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const [_, __, ___, ____, client4, client5] = await ethers.getSigners();

        await simpleNFT.mintWithID(client4.address, tokenId, "image.jpeg");
        await simpleNFT.connect(client4).setApprovalForAll(fractionalizeNFT.address, true);

        await fractionalizeNFT.connect(client4).depositFractionalizeSell(simpleNFT.address, tokenId, totalSupply, 
            "First Test Token", "FTT", weiPricePerToken);

        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);

        await fractionalizeNFT.connect(client5).buy(uniqueTokenId, availableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * availableSupply).toString())
        });

        await approveForUserBoughtToken(0, client5);

        await fractionalizeNFT.connect(client5).buyBackNFT(uniqueTokenId);
        expect(await simpleNFT.ownerOf(tokenId)).to.be.equal(client5.address);

        const allNFTsForSale = await fractionalizeNFT.getAllNFTsForSale();
        expect(allNFTsForSale.length).to.be.equal(0);
    });

    it("Should deposit NFT", async function() {
        const tokenId = 1;
        await simpleNFT.mintWithID(deployer.address, tokenId, "image.jpeg");

        await fractionalizeNFT.deposit(simpleNFT.address, tokenId);

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [{
            "fractionalized": false,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": 0,
                "availableFractions": 0,
                "weiPricePerToken": 0,
                "uniqueTokenId": await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId),
                "forSale": false,
                "soldOut": false,
            }
        }]);
    });

    it("Should fail to publish for sale not fractionalized NFT", async function() {
        const tokenId = 1;
        const weiPricePerToken = ethers.utils.parseEther("0.01");
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await expect(fractionalizeNFT.sell(uniqueTokenId, weiPricePerToken)).to.be.revertedWith("Token is not fractionalized.");
    });

    it("Should fail to fractionalize other user NFT", async function() {
        const [_, client1] = await ethers.getSigners();
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, 1);
        await expect(fractionalizeNFT.connect(client1).fractionalize(uniqueTokenId, 12, "Test Token", "TT"))
            .to.be.revertedWith("You dont own this token.");
    });

    it("Should fractionalize, deposited NFT", async function() {
        const tokenId = 1;
        const totalSupply = 100;
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await fractionalizeNFT.fractionalize(uniqueTokenId, totalSupply, "Test Token", "TT");

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [{
            "fractionalized": true,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": totalSupply,
                "availableFractions": totalSupply,
                "weiPricePerToken": 0,
                "uniqueTokenId": uniqueTokenId,
                "forSale": false,
                "soldOut": false,
            }
        }]);
    });

    it("Should fail to fractionalize already fractionalized NFT", async function() {
        const tokenId = 1;
        const totalSupply = 100;
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await expect(fractionalizeNFT.fractionalize(uniqueTokenId, totalSupply, "Test Token", "TT"))
            .to.be.revertedWith("Token is already fractionalized.");
    });

    it("Should publish for sale, ERC20 fractions", async function() {
        const tokenId = 1;
        const totalSupply = 100;
        const weiPricePerToken = ethers.utils.parseEther("0.01");

        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await fractionalizeNFT.sell(uniqueTokenId, weiPricePerToken);

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [{
            "fractionalized": true,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": totalSupply,
                "availableFractions": totalSupply,
                "weiPricePerToken": weiPricePerToken,
                "uniqueTokenId": uniqueTokenId,
                "forSale": true,
                "soldOut": false,
            }
        }]);
    });

    it("Should fail to publish for sale, already published for sale ERC20 fractions", async function() {
        const tokenId = 1;
        const weiPricePerToken = ethers.utils.parseEther("0.01");
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await expect(fractionalizeNFT.sell(uniqueTokenId, weiPricePerToken)).to.be.revertedWith("Token is already for sale.");
    });

    it("Should allow to buy published for sale ERC20 fractions from different clients", async function() {
        const tokenId = 1;
        const totalSupply = 100;
        const client1BuyAmount = 20;
        const client2BuyAmount = 1;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);

        const [_, client1, client2] = await ethers.getSigners();

        await fractionalizeNFT.connect(client1).buy(uniqueTokenId, client1BuyAmount, {
            value: ethers.utils.parseEther((ethPricePerToken * client1BuyAmount).toString())
        });

        const client1BoughtFractions = await fractionalizeNFT.connect(client1).getUserBoughtFractions();
        helpers.expectArraysEqual(client1BoughtFractions, [{
            "amount": client1BuyAmount,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": totalSupply,
                "availableFractions": totalSupply - client1BuyAmount,
                "weiPricePerToken": weiPricePerToken,
                "uniqueTokenId": uniqueTokenId,
                "forSale": true,
                "soldOut": false,
            }
        }]);

        await fractionalizeNFT.connect(client2).buy(uniqueTokenId, client2BuyAmount, {
            value: ethers.utils.parseEther((ethPricePerToken * client2BuyAmount).toString())
        });

        const client2BoughtFractions = await fractionalizeNFT.connect(client2).getUserBoughtFractions();
        helpers.expectArraysEqual(client2BoughtFractions, [{
            "amount": client2BuyAmount,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": totalSupply,
                "availableFractions": totalSupply - (client1BuyAmount + client2BuyAmount),
                "weiPricePerToken": weiPricePerToken,
                "uniqueTokenId": uniqueTokenId,
                "forSale": true,
                "soldOut": false,
            }
        }]);

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [{
            "fractionalized": true,
            "token": {
                "tokenContract": simpleNFT.address,
                "tokenId": tokenId,
                "fractionsTotalSupply": totalSupply,
                "availableFractions": totalSupply - (client1BuyAmount + client2BuyAmount),
                "weiPricePerToken": weiPricePerToken,
                "uniqueTokenId": uniqueTokenId,
                "forSale": true,
                "soldOut": false,
            }
        }]);
    });

    it ("Should deposit, fractionalize, publish for sale", async function() {
        const firstTokenId = 1, secondTokenId = 2, thirdTokenId = 3;
        const firstTokenTotalSupply = 100, firstTokenAvailableSupply = 79;
        const secondTokenTotalSupply = 555, secondTokenAvailableSupply = 555;
        const thirdTokenTotalSupply = 66, thirdTokenAvailableSupply = 66;
        const weiPricePerToken = ethers.utils.parseEther("0.01");

        await simpleNFT.mintWithID(deployer.address, secondTokenId, "image.jpeg");
        await fractionalizeNFT.depositFractionalizeSell(simpleNFT.address, secondTokenId, secondTokenTotalSupply, 
            "Test Token 2", "TT2", weiPricePerToken);

        await simpleNFT.mintWithID(deployer.address, thirdTokenId, "image.jpeg");
        await fractionalizeNFT.depositFractionalizeSell(simpleNFT.address, thirdTokenId, thirdTokenTotalSupply, 
            "Test Token 3", "TT3", weiPricePerToken);

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": thirdTokenId,
                    "fractionsTotalSupply": thirdTokenTotalSupply,
                    "availableFractions": thirdTokenAvailableSupply,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, thirdTokenId),
                    "forSale": true,
                    "soldOut": false,
                }
            },
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": secondTokenId,
                    "fractionsTotalSupply": secondTokenTotalSupply,
                    "availableFractions": secondTokenAvailableSupply,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondTokenId),
                    "forSale": true,
                    "soldOut": false,
                }
            },
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": firstTokenId,
                    "fractionsTotalSupply": firstTokenTotalSupply,
                    "availableFractions": firstTokenAvailableSupply,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, firstTokenId),
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);
    });

    it("Should fail to buy non-existing token", async function() {
        const secondTokenAvailableSupply = 555;
        const ethPricePerToken = 0.01;
        await expect(fractionalizeNFT.buy(2232323, secondTokenAvailableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * secondTokenAvailableSupply).toString())
        })).to.be.revertedWith("Token not found.");
    });
    
    it("Should fail to buy own ERC20 fractions", async function() {
        const secondTokenId = 2
        const secondTokenAvailableSupply = 555;
        const ethPricePerToken = 0.01;
        const secondUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondTokenId);
        await expect(fractionalizeNFT.buy(secondUniqueTokenId, secondTokenAvailableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * secondTokenAvailableSupply).toString())
        })).to.be.revertedWith("You cannot buy your own fractions.");
    });

    it("Should fail to buy ERC20 fractions with insufficient wei", async function() {
        const secondTokenId = 2
        const secondTokenAvailableSupply = 555;
        const ethPricePerToken = 0.001;
        const secondUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondTokenId);

        const [_, __, ___, client3] = await ethers.getSigners();
        await expect(fractionalizeNFT.connect(client3).buy(secondUniqueTokenId, secondTokenAvailableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * secondTokenAvailableSupply).toString())
        })).to.be.revertedWith("Insufficient wei.");
    });

    it("Should buy all ERC20 fractions of seller", async function() {
        const firstTokenId = 1, secondTokenId = 2, thirdTokenId = 3;
        const firstTokenTotalSupply = 100, firstTokenAvailableSupply = 79;
        const secondTokenTotalSupply = 555, secondTokenAvailableSupply = 555;
        const thirdTokenTotalSupply = 66, thirdTokenAvailableSupply = 66;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const firstUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, firstTokenId);
        const secondUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondTokenId);
        const thirdUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, thirdTokenId);

        const [_, __, ___, client3] = await ethers.getSigners();

        await fractionalizeNFT.connect(client3).buy(secondUniqueTokenId, secondTokenAvailableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * secondTokenAvailableSupply).toString())
        });

        await fractionalizeNFT.connect(client3).buy(thirdUniqueTokenId, thirdTokenAvailableSupply, {
            value: ethers.utils.parseEther((ethPricePerToken * thirdTokenAvailableSupply).toString())
        });

        const userNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(userNFTs, [
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": thirdTokenId,
                    "fractionsTotalSupply": thirdTokenTotalSupply,
                    "availableFractions": 0,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": thirdUniqueTokenId,
                    "forSale": false,
                    "soldOut": true,
                }
            },
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": secondTokenId,
                    "fractionsTotalSupply": secondTokenTotalSupply,
                    "availableFractions": 0,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": secondUniqueTokenId,
                    "forSale": false,
                    "soldOut": true,
                }
            },
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": firstTokenId,
                    "fractionsTotalSupply": firstTokenTotalSupply,
                    "availableFractions": firstTokenAvailableSupply,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": firstUniqueTokenId,
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);

        const client3BoughtFractions = await fractionalizeNFT.connect(client3).getUserBoughtFractions();
        helpers.expectArraysEqual(client3BoughtFractions, [
            {
                "amount": thirdTokenAvailableSupply,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": thirdTokenId,
                    "fractionsTotalSupply": thirdTokenTotalSupply,
                    "availableFractions": 0,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": thirdUniqueTokenId,
                    "forSale": false,
                    "soldOut": true,
                }
            },
            {
                "amount": secondTokenAvailableSupply,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": secondTokenId,
                    "fractionsTotalSupply": secondTokenTotalSupply,
                    "availableFractions": 0,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": secondUniqueTokenId,
                    "forSale": false,
                    "soldOut": true,
                }
            }
        ]);
    });

    it("Should fail to publish for sale, already soldout ERC20 fractions", async function() {
        const tokenId = 2;
        const weiPricePerToken = ethers.utils.parseEther("0.01");
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        await expect(fractionalizeNFT.sell(uniqueTokenId, weiPricePerToken)).to.be.revertedWith("Token is already sold out.");
    });

    it("Should fail to buy back NFT if not all ERC20 fractions are owned", async function() {
        const firstTokenId = 1;
        const firstUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, firstTokenId);
        const [_, client1] = await ethers.getSigners();
        await expect(fractionalizeNFT.connect(client1).buyBackNFT(firstUniqueTokenId)).to.be.revertedWith("You dont own all fractions.");
        expect(await simpleNFT.ownerOf(firstTokenId)).to.be.equal(fractionalizeNFT.address);
    });

    it("Should buy back NFT in the middle of double linked list", async function() {
        const secondTokenId = 2, thirdTokenId = 3;
        const thirdTokenTotalSupply = 66, thirdTokenAvailableSupply = 66;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());
        
        const secondUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondTokenId);
        const thirdUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, thirdTokenId);
        
        const [_, __, ___, client3] = await ethers.getSigners();
        
        await approveForUserBoughtToken(1, client3);

        await fractionalizeNFT.connect(client3).buyBackNFT(secondUniqueTokenId);
        expect(await simpleNFT.ownerOf(secondTokenId)).to.be.equal(client3.address);

        const client3BoughtFractions = await fractionalizeNFT.connect(client3).getUserBoughtFractions();
        helpers.expectArraysEqual(client3BoughtFractions, [
            {
                "amount": thirdTokenAvailableSupply,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": thirdTokenId,
                    "fractionsTotalSupply": thirdTokenTotalSupply,
                    "availableFractions": 0,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": thirdUniqueTokenId,
                    "forSale": false,
                    "soldOut": true,
                }
            }
        ]);
    });

    it("Should buy back last NFT in the double linked list", async function() {
        const thirdTokenId = 3;
        
        const thirdUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, thirdTokenId);
        
        const [_, __, ___, client3] = await ethers.getSigners();

        await approveForUserBoughtToken(0, client3);
        
        await fractionalizeNFT.connect(client3).buyBackNFT(thirdUniqueTokenId);
        expect(await simpleNFT.ownerOf(thirdTokenId)).to.be.equal(client3.address);
    });

    it("Should list all NFTs for sale", async function() {
        const firstTokenId = 1;
        const firstTokenTotalSupply = 100, firstTokenAvailableSupply = 79;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const firstUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, firstTokenId);

        const nftsForSale = await fractionalizeNFT.getAllNFTsForSale();
        helpers.expectArraysEqual(nftsForSale, [
            {
                "tokenContract": simpleNFT.address,
                "tokenId": firstTokenId,
                "fractionsTotalSupply": firstTokenTotalSupply,
                "availableFractions": firstTokenAvailableSupply,
                "weiPricePerToken": weiPricePerToken,
                "uniqueTokenId": firstUniqueTokenId,
                "forSale": true,
                "soldOut": false,
            },
        ]);
    });

    it("Should withdraw user profits", async function() {
        const expectedUserProfit = "6.42";
        let userProfit = await fractionalizeNFT.getUserProfit();
        expect(ethers.utils.formatEther(userProfit)).to.equal(expectedUserProfit);

        const initialUserBalance = parseFloat(ethers.utils.formatEther(await deployer.getBalance()));

        await fractionalizeNFT.withdrawSalesProfit();

        userProfit = await fractionalizeNFT.getUserProfit();
        expect(ethers.utils.formatEther(userProfit)).to.equal("0.0");
        
        const withdrawTransferFee = 0.01;
        const newUserBalance = parseFloat(ethers.utils.formatEther(await deployer.getBalance()));
        expect(newUserBalance).to.be.above(initialUserBalance + parseFloat(expectedUserProfit) - withdrawTransferFee);
    });

    it("Should fail to withdraw user profits if under the minimal required amount", async function() {
        await expect(fractionalizeNFT.withdrawSalesProfit()).to.be.revertedWith("You have less than minimal required funds to withdraw.");
    });

    it("Should set withdraw minimal required amount", async function() {
        const minWithdrawWeiAmount = 919191;
        await fractionalizeNFT.setMinWithdrawWeiAmount(minWithdrawWeiAmount);
        expect(await fractionalizeNFT.getMinWithdrawWeiAmount()).to.equal(minWithdrawWeiAmount);
    });

    it("Shoul fail to set withdraw minimal required amount if not owner", async function() {
        const minWithdrawWeiAmount = 919191;
        const [_, __, ___, client3] = await ethers.getSigners();
        await expect(fractionalizeNFT.connect(client3).setMinWithdrawWeiAmount(minWithdrawWeiAmount))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Same user should buy from same fractions twice", async function() {
        const tokenId = 1;
        const totalSupply = 100;
        const availableSupply = 79;
        const client1BuyAmount = 1;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);

        const [_, client1] = await ethers.getSigners();

        let client1BoughtFractions = await fractionalizeNFT.connect(client1).getUserBoughtFractions();
        const currentBoughtAmount = client1BoughtFractions[0]["amount"];

        await fractionalizeNFT.connect(client1).buy(uniqueTokenId, client1BuyAmount, {
            value: ethers.utils.parseEther((ethPricePerToken * client1BuyAmount).toString())
        });

        await fractionalizeNFT.connect(client1).buy(uniqueTokenId, client1BuyAmount, {
            value: ethers.utils.parseEther((ethPricePerToken * client1BuyAmount).toString())
        });

        client1BoughtFractions = await fractionalizeNFT.connect(client1).getUserBoughtFractions();
        helpers.expectArraysEqual(client1BoughtFractions, [
            {
                "amount": parseInt(currentBoughtAmount.toString()) + (client1BuyAmount * 2),
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": tokenId,
                    "fractionsTotalSupply": totalSupply,
                    "availableFractions": availableSupply - (client1BuyAmount * 2),
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": uniqueTokenId,
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);
    });

    it("Should get correct user NFTs when there are NFTs from multiple users", async function() {
        const deployerTokenId = 1, firstClientTokenId = 10, secondClientTokenId = 11;
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());

        const deployerUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, deployerTokenId);
        const firstClientUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, firstClientTokenId);
        const secondClientUniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, secondClientTokenId);

        const [_, client1, client2] = await ethers.getSigners();

        await simpleNFT.connect(client1).setApprovalForAll(fractionalizeNFT.address, true);
        await simpleNFT.mintWithID(client1.address, firstClientTokenId, "image.jpeg");
        await fractionalizeNFT.connect(client1).deposit(simpleNFT.address, firstClientTokenId);

        await simpleNFT.connect(client2).setApprovalForAll(fractionalizeNFT.address, true);
        await simpleNFT.mintWithID(client2.address, secondClientTokenId, "image.jpeg");
        await fractionalizeNFT.connect(client2).deposit(simpleNFT.address, secondClientTokenId);

        const deployerNFTs = await fractionalizeNFT.getUserNFTs();
        helpers.expectArraysEqual(deployerNFTs, [
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": deployerTokenId,
                    "fractionsTotalSupply": 100,
                    "availableFractions": 77,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": deployerUniqueTokenId,
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);

        const client1NFTs = await fractionalizeNFT.connect(client1).getUserNFTs();
        helpers.expectArraysEqual(client1NFTs, [
            {
                "fractionalized": false,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": firstClientTokenId,
                    "fractionsTotalSupply": 0,
                    "availableFractions": 0,
                    "weiPricePerToken": 0,
                    "uniqueTokenId": firstClientUniqueTokenId,
                    "forSale": false,
                    "soldOut": false,
                }
            }
        ]);

        const client2NFTs = await fractionalizeNFT.connect(client2).getUserNFTs();
        helpers.expectArraysEqual(client2NFTs, [
            {
                "fractionalized": false,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": secondClientTokenId,
                    "fractionsTotalSupply": 0,
                    "availableFractions": 0,
                    "weiPricePerToken": 0,
                    "uniqueTokenId": secondClientUniqueTokenId,
                    "forSale": false,
                    "soldOut": false,
                }
            }
        ]);
    });

    it("Should return only NFTs for sale when there are deopisted not for sale", async function() {
        const tokenId = 102;
        
        const clients = await ethers.getSigners();
        const client7 = clients[8]
        
        await simpleNFT.mintWithID(client7.address, tokenId, "image.jpeg");
        await simpleNFT.connect(client7).setApprovalForAll(fractionalizeNFT.address, true);

        const allNFTsForSaleBeforeDeposit = await fractionalizeNFT.getAllNFTsForSale();

        await fractionalizeNFT.connect(client7).deposit(simpleNFT.address, tokenId);
        
        const allNFTsForSaleAfterDeposit = await fractionalizeNFT.getAllNFTsForSale();

        helpers.expectArraysEqual(allNFTsForSaleBeforeDeposit, allNFTsForSaleAfterDeposit);
    })

    it("Should deposit, then fractionalizeSell", async function() {
        const tokenId = 101, totalSupply = 90101, weiPricePerToken = ethers.utils.parseEther('0.12');
        
        const clients = await ethers.getSigners();
        const client7 = clients[6]
        
        await simpleNFT.mintWithID(client7.address, tokenId, "image.jpeg");
        await simpleNFT.connect(client7).setApprovalForAll(fractionalizeNFT.address, true);

        await fractionalizeNFT.connect(client7).deposit(simpleNFT.address, tokenId);

        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);

        await fractionalizeNFT.connect(client7).fractionalizeSell(uniqueTokenId, totalSupply, "Test Token 3", "TT3", weiPricePerToken)

        const client7NFTs = await fractionalizeNFT.connect(client7).getUserNFTs();
        helpers.expectArraysEqual(client7NFTs, [
            {
                "fractionalized": true,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": tokenId,
                    "fractionsTotalSupply": totalSupply,
                    "availableFractions": totalSupply,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": uniqueTokenId,
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);
    })

    it("Should return empty array when no user bought fractions", async function () {
        const clients = await ethers.getSigners();
        const client11 = clients[10]

        const userFractions = await fractionalizeNFT.connect(client11).getUserBoughtFractions();
        expect(userFractions.length).to.be.equal(0);
    })

    it("Should return correct user bought fractions", async function () {
        const tokenId = 1;
        const uniqueTokenId = await fractionalizeNFT.getUniqueTokenId(simpleNFT.address, tokenId);
        const ethPricePerToken = 0.01;
        const weiPricePerToken = ethers.utils.parseEther(ethPricePerToken.toString());
        const currentBoughtAmount = 22, totalSupply= 100, supplyForSale = 77;

        const clients = await ethers.getSigners();
        const client2 = clients[1];
        const userFractions = await fractionalizeNFT.connect(client2).getUserBoughtFractions();
        helpers.expectArraysEqual(userFractions, [
            {
                "amount": currentBoughtAmount,
                "token": {
                    "tokenContract": simpleNFT.address,
                    "tokenId": tokenId,
                    "fractionsTotalSupply": totalSupply,
                    "availableFractions": supplyForSale,
                    "weiPricePerToken": weiPricePerToken,
                    "uniqueTokenId": uniqueTokenId,
                    "forSale": true,
                    "soldOut": false,
                }
            }
        ]);
    })
});