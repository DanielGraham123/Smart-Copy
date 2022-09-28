// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SmartCopyToken is ERC20 {
    constructor(
        address owner,
        string memory tokenName,
        uint256 supply
    ) ERC20(tokenName, "SCP") {
        _mint(owner, supply * 10**decimals());
    }
}

interface ERC20Interface {
    function transfer(address, uint256) external returns (bool);

    function approve(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function totalSupply() external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract SmartCopy {
    struct Work {
        address payable owner;
        WorkInfo info;
        uint256 licensePrice;
        uint256 licenseCount;
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
        uint256 workIndex;
        uint256 issueDate;
        uint256 expiringDate;
        bool expired;
    }

    uint256 private worksLength = 0;
    uint256 private licensesLength = 0;
    uint256 private expiredLicensesLength = 0;

    // cUSD ERC-Token address from the Celo alfajores test network
    address private cUSDTokenaddress =
        0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    address private testaddr = 0x722f706205cF3e1C0acFCe5A4870361a4F240d24;

    mapping(uint256 => Work) private works;
    mapping(uint256 => License) private licenses;

    uint256 expireDate = 2 minutes;

    // modifier to check if work has been deleted
    modifier checkIfDeleted(uint256 _index) {
        require(
            works[_index].isDeleted == false,
            "Sorry, this work has been deleted"
        );
        _;
    }
    // modifer to check the input data for struct WorkInfo
    modifier checkInputData(WorkInfo memory _info) {
        require(bytes(_info.description).length > 0, "Empty description");
        require(bytes(_info.image).length > 0, "Empty image");
        require(bytes(_info.name).length > 0, "Empty name");
        require(bytes(_info.termsOfUse).length > 0, "Empty terms of use");
        _;
    }

    // modifier to check if caller is the owner of work with id "_index"
    modifier onlyWorkOwner(uint256 _index) {
        require(
            msg.sender == works[_index].owner,
            "Only an author can delete his/her Work"
        );
        _;
    }


    /**
        * @dev allow users to create a work
        * @notice input data needs to contain only valid values
     */
    function createWork(
        WorkInfo memory _info,
        uint256 _licensePrice,
        bool _isSelling
    ) public checkInputData(_info) {
        uint256 _licenseCount = 0;

        // create tokens(license tokens) for each work per owner
        SmartCopyToken _licenseToken = new SmartCopyToken(
            address(this),
            _info.name,
            _isSelling == true ? 100000 : 1
        );

        works[worksLength] = Work(
            payable(msg.sender),
            _info,
            _licensePrice,
            _licenseCount,
            _licenseToken,
            false,
            _isSelling
        );

        worksLength++;
    }

    /**
        * @return Work data for a work with id "_index"
     */
    function readWork(uint256 _index)
        public
        view
        checkIfDeleted(_index)
        returns (
            address payable,
            WorkInfo memory,
            uint256,
            uint256,
            SmartCopyToken,
            bool
        )
    {
        return (
            works[_index].owner,
            works[_index].info,
            works[_index].licensePrice,
            works[_index].licenseCount,
            works[_index].licenseToken,
            works[_index].isDeleted
        );
    }

    function readWorksLength() public view returns (uint256) {
        return worksLength;
    }

    function readLicensesLength() public view returns (uint256) {
        return licensesLength;
    }

    /**
        * @return address returns the license smartcontract's address for a work with id "_index"
     */
    function getLicenseAddress(uint256 _index)
        public
        view
        checkIfDeleted(_index)
        returns (address)
    {
        return address(works[_index].licenseToken);
    }

    /**
        * @dev allow work owners to update their work
        * @notice input data needs to contain only valid values
        * @notice Work must exists
     */
    function updateWork(
        uint256 _index,
        WorkInfo memory _info,
        uint256 _licensePrice,
        bool _isSelling
    )
        public
        checkIfDeleted(_index)
        onlyWorkOwner(_index)
        checkInputData(_info)
        returns (Work memory)
    {
        Work storage currentWork = works[_index];

        currentWork.info = _info;
        currentWork.licensePrice = _licensePrice;
        currentWork.isSelling = _isSelling;

        return works[_index];
    }

    function deleteWork(uint256 _index)
        public
        checkIfDeleted(_index)
        onlyWorkOwner(_index)
    {
        require(
            works[_index].licenseCount == 0,
            "The work cannot be deleted if some licenses are already issued"
        );
        delete works[_index];
        works[_index].isDeleted = true;
    }

    /**
        * @dev sets a license to become expired
        * @notice expiring date has to be reached
     */
    function removeLicense(uint256 _index, uint256 _workIndex)
        public
    {
        License storage currentLicense = licenses[_index];
        require(currentLicense.workIndex == _workIndex,"This license isn't associated with the requested work index");
        require(currentLicense.expiringDate <= block.timestamp, "License hasn't expired yet");
        currentLicense.expired = true;
        works[_workIndex].licenseCount--;
    }

    function getExpiredLicenses(uint256 _index)
        public
        view
        returns (
            address,
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        require(
            licensesLength > 0 && _index < licensesLength,
            "Sorry, there no licenses"
        );
        return (
            licenses[_index].buyer,
            licenses[_index].workIndex,
            licenses[_index].issueDate,
            licenses[_index].expiringDate,
            licenses[_index].expired
        );
    }

    function getRemainingTokens(uint256 _index)
        public
        view
        checkIfDeleted(_index)
        returns (uint256)
    {
        return works[_index].licenseToken.totalSupply() / 1 ether;
    }

    /**
        * @dev allow users to buy a work license from a work with id "index"
     */
    function buyWorkLicense(uint256 _index)
        public
        payable
        checkIfDeleted(_index)
    {
        Work storage currentWork = works[_index];
        require(
            currentWork.owner != msg.sender,
            "You can't buy a work license from yourself"
        );
        require(getRemainingTokens(_index) > 0, "Number of license that can be obtained for work has been reached");

        // transfer tokens from buyer to seller
        require(
            ERC20Interface(cUSDTokenaddress).transferFrom(
                msg.sender,
                currentWork.owner,
                currentWork.licensePrice
            ),
            "Transaction Failed"
        );

        // issue license token to buyer
        require(
            currentWork.licenseToken.transfer(msg.sender, 1 ether),
            "Transfer of License token to buyer failed"
        );

        currentWork.licenseCount++;

        License storage currentLicense = licenses[licensesLength];
        licensesLength++;

        // register the license
        currentLicense.buyer = msg.sender;
        currentLicense.workIndex = _index;
        currentLicense.issueDate = block.timestamp;
        currentLicense.expiringDate = block.timestamp + expireDate; // licenses expire after 2 minutes by default
        currentLicense.expired = false;
    }
}
