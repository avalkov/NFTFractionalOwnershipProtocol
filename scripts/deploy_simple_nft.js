const hre = require("hardhat");


async function main() {
  const SimpleNFT = await hre.ethers.getContractFactory("SimpleNFT");
  const simpleNFT = await SimpleNFT.deploy("Limes", "LC");

  await simpleNFT.deployed();

  console.log("SimpleNFT deployed to:", simpleNFT.address);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
