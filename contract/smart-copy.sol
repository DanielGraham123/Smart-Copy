// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts@4.7.3/token/ERC20/ERC20.sol";

contract SmartCopyToken is ERC20 {
    constructor(address owner, string memory tokenName, uint supply) ERC20(tokenName, "SCP") {
        _mint(owner, supply * 10 ** decimals());
    }
}

interface ERC20Interface {
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract SmartCopy {
    struct Work {
        address payable owner;
        WorkInfo info;
        uint licensePrice;
        uint licenseCount;
        SmartCopyToken licenseToken;
        bool isDeleted;
        bool isSelling;
    }

    struct WorkInfo {
        string name;
        string image;
        string description;
        string termsOfUse;
    }

    struct License {
        address buyer;
        uint workIndex;
        uint issueDate;
        uint expiringDate;
        bool expired;
    }

    uint internal worksLength = 0;
    uint internal licensesLength = 0;
    uint internal expiredLicensesLength = 0;

    // cUSD ERC-Token address from the Celo alfajores test network
    address internal cUSDTokenaddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    address internal testaddr = 0x722f706205cF3e1C0acFCe5A4870361a4F240d24;
    // making it public creates an inferred 'getWorks()' function
    mapping(uint => Work) public works;
    mapping(uint => License) public licenses;
    mapping(uint => License) public expiredLicenses;

    uint expireDate = block.timestamp + 2 minutes;

    function createWork(
        WorkInfo memory _info,
        uint _licensePrice,
        bool _isSelling
    ) public {

        uint _licenseCount = 0;

        // create tokens(license tokens) for each work per owner
        SmartCopyToken _licenseToken = new SmartCopyToken(address(this), _info.name, _isSelling == true ? 100000 : 1);

        works[worksLength] = Work(
            payable(msg.sender),
            _info, _licensePrice, _licenseCount, _licenseToken, false, _isSelling
        );

        worksLength++;
    }

    function readWork(uint _index) public view returns (
        address payable,
        WorkInfo memory,
        uint, uint,
        SmartCopyToken,
        bool
    ) {
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");

        return (
            works[_index].owner,
            works[_index].info,
            works[_index].licensePrice,
            works[_index].licenseCount,
            works[_index].licenseToken,
            works[_index].isDeleted
        );
    }

    function readWorksLength() view public returns (uint) {
        return worksLength;
    }

    function readLicensesLength() view public returns (uint) {
        return licensesLength;
    }

    function readExpiredLicensesLength() view public returns (uint) {
        return expiredLicensesLength;
    }

    function getWorkLicensePrice(uint _index) public view returns (uint) {
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");
        return works[_index].licensePrice;
    } 

    function getNumberOfLicenses(uint _index) public view returns (uint) {
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");
        return works[_index].licenseCount;
    }

    function getLicenseAddress(uint _index) public view returns (address) {
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");
        return address(works[_index].licenseToken);
    }

    function updateWork(uint _index,
        WorkInfo memory _info,
        uint _licensePrice,
        bool _isSelling
    ) public returns (Work memory) {
        require(msg.sender==works[_index].owner, "Only an author can delete his/her Work");
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");
        works[_index].info = _info;
        works[_index].licensePrice = _licensePrice;
        works[_index].isSelling = _isSelling;

        return works[_index];
    }

    function deleteWork(uint _index) public {
        require(msg.sender == works[_index].owner, "Only an author can delete his/her Work");
        require(works[_index].licenseCount == 0, "The work cannot be deleted if some licenses are alread issued");
        delete works[_index];
        works[_index].isDeleted = true;
    }

    function removeLicense(uint _index, uint _workIndex) public {
        licenses[_index].expired = true;

        expiredLicenses[expiredLicensesLength] = licenses[_index];

        expiredLicensesLength++; 
        works[_workIndex].licenseCount--;

        delete licenses[_index];

    }

    function getExpiredLicenses(uint _index) 
                public view returns (
                    address, 
                    uint, 
                    uint, uint, bool) {
        require(licensesLength > 0, "Sorry, there no licenses");
        require(expiredLicensesLength > 0, "Sorry, there no expired licenses");

        return (
            expiredLicenses[_index].buyer,
            expiredLicenses[_index].workIndex,
            expiredLicenses[_index].issueDate,
            expiredLicenses[_index].expiringDate,
            expiredLicenses[_index].expired
        );
    }

    function getRemainingTokens(uint _index) public view returns (uint) {
        return works[_index].licenseToken.totalSupply() / 10**18;
    }

    function buyWorkLicense(uint _index) public payable {
        // check if the work has not been deleted
        require(works[_index].isDeleted == false, "Sorry, this work has been deleted");

        // transfer tokens from buyer to seller 
        require(
            ERC20Interface(cUSDTokenaddress).transferFrom(
                msg.sender, 
                works[_index].owner, 
                works[_index].licensePrice), "Transaction Failed");

        // issue license token to buyer
        require(works[_index].licenseToken.transfer(msg.sender,1), "Transfer of License token to buyer failed");
        
        works[_index].licenseCount++;

        // register the license
        licenses[licensesLength].buyer = msg.sender;
        licenses[licensesLength].workIndex = _index;
        licenses[licensesLength].issueDate = block.timestamp;
        licenses[licensesLength].expiringDate = expireDate; // licenses expire after 1 month by default
        licenses[licensesLength].expired = false;

        licensesLength++;
        
    }

}