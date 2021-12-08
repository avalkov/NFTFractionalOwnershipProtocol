const hre = require("hardhat");


async function main() {
  const FractionalizeNFT = await hre.ethers.getContractFactory("FractionalizeNFT");
  const fractionalizeNFT = await FractionalizeNFT.deploy();

  await fractionalizeNFT.deployed();

  console.log("FractionalizeNFT deployed to:", fractionalizeNFT.address);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
