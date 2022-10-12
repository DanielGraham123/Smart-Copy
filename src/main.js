import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
import BigNumber from "bignumber.js";
import marketplaceAbi from "../contract/smart-copy.abi.json";
import erc20Abi from "../contract/erc20.abi.json";

const ERC20_DECIMALS = 18;
const MPContractAddress = "0xf99Fda78A0ce213d0D3e49C087aA4E9EEf12FdfC";
// cUSD smart contract address
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

const celoExplorer = "https://alfajores-blockscout.celo-testnet.org";

let kit;
let contract;
let works = [];
let licenses = [];

let licensesOfInterest = [];
let interestCount = 0;

let editWorkBtn = document.querySelector("#editWorkBtn");

let selectForm = document.querySelector(".form-select");
let editDiv = document.querySelector("#editDiv");
let selectedWork = {};

let notifyPermGranted = false;

let editWorkName = document.querySelector("#editWorkName");
let editImageUrl = document.querySelector("#editImgUrl");
let editWorkDesc = document.querySelector("#editWorkDescription");
let editSelling = document.querySelector("#editSelling");
let editPrice = document.querySelector("#editPrice");

editDiv.style.display = "none";
editWorkBtn.style.display = "none";

const connectCeloWallet = async () => {
  // check if celo object exists
  if (window.celo) {
    notification("⚠️ Please approve this DApp to use it.");
    try {
      // to enable connection to you celo wallet
      await window.celo.enable();
      notificationOff();

      // create a new contractkit instance
      const web3 = new Web3(window.celo);
      kit = newKitFromWeb3(web3);

      // get celo address of current user
      const accounts = await kit.web3.eth.getAccounts();
      kit.defaultAccount = accounts[0];

      // connect to the marketplace contract
      contract = new kit.web3.eth.Contract(marketplaceAbi, MPContractAddress);
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  } else {
    notification("⚠️ Please install the CeloExtensionWallet.");
  }
};

// get user's balance
const getBalance = async function () {
  const totalBalance = await kit.getTotalBalance(kit.defaultAccount);
  const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2);
  document.querySelector("#balance").textContent = cUSDBalance;
};

async function getWorks() {
  const worksCount = await contract.methods.readWorksLength().call();
  editWorkBtn.style.display = "none";
  
  const _works = [];
  for (let i = 0; i < worksCount; i++) {
    let _work = new Promise(async (resolve, reject) => {
      let p = await contract.methods.works(i).call();
      resolve({
        index: i,
        owner: p[0],
        name: p[1][0],
        image: p[1][1],
        description: p[1][2],
        terms: p[1][3],
        price: new BigNumber(p[2]),
        licenseCount: p[3],
        licenseTokenAddr: p[4],
        deleted: p[5],
        selling: p[6],
      });
    });
    _works.push(_work);
  }
  works = await Promise.all(_works);
  renderWorks();
}

async function getLicenses() {
  const licensesCount = await contract.methods.readLicensesLength().call();
  const _licenses = [];
  for (let i = 0; i < licensesCount; i++) {
    let _license = new Promise(async (resolve, reject) => {
      let p = await contract.methods.licenses(i).call();
      resolve({
        index: i,
        buyer: p[0],
        workIndex: parseInt(p[1]),
        issuedOn: parseInt(p[2]),
        expiresOn: parseInt(p[3]),
        expired: p[4],
      });
    });
    _licenses.push(_license);
  }
  licenses = await Promise.all(_licenses);
}

function renderWorks() {
  document.getElementById("marketplace").innerHTML = "";
  let cleanedWorks = works.filter((work) => !work.deleted);
  if (cleanedWorks.length > 0) {
    

    editWorkBtn.style.display = "block";
  }
  cleanedWorks.forEach((_work) => {
    const newDiv = document.createElement("div");
    newDiv.className = "col-md-4";
    newDiv.innerHTML = productTemplate(_work);
    document.getElementById("marketplace").appendChild(newDiv);
  });
  ownerWorks(cleanedWorks);
}

function resetSelect() {
  let length = selectForm.options.length;
  for (let i = length - 1; i >= 1; i--) {
    selectForm.options[i] = null;
  }
}

function ownerWorks(works) {
  resetSelect();
  let myWorks = works.filter((work) => work.owner == kit.defaultAccount);
  myWorks.forEach((work) => {
    selectForm.options[selectForm.options.length] = new Option(
      work.name,
      work.index
    );
  });
}

function productTemplate(_work) {
  
  let currentViewer = _work.owner == kit.defaultAccount;

  return `
     <div class="card bg-dark text-white mb-4 ${_work.deleted && "d-none"}">
      <img class="card-img-top" src="${_work.image}" alt="...">
     
     <div class="position-absolute top-0 end-0 mt-2 mr-4">
        ${
          _work.selling
            ? `<span class="badge bg-primary">On Sale</span>`
            : `<span class="badge bg-danger">Not For Sale</span>`
        }
     </div>
      
       <div class="card-body text-left p-4 position-relative ">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_work.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_work.name}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          ${_work.description}             
        </p>
        <p class="card-text mt-4">
          <span><a class="text-greenblue" href="${celoExplorer}/token/${
    _work.licenseTokenAddr
  }/token-transfers" target="_blank" id="${_work.index}">License Token</a>
          <i class="bi bi-box-arrow-up-right" style="font-size:0.7rem;"></i>
          </span>
        </p>
        
        <div class="d-grid gap-2">
        
        <!-- show read button -->
          <a class="btn btn-lg btn-infom viewBtn fs-6 p-3" id="${
            _work.index
          }"  data-bs-toggle="modal"
              data-bs-target="#viewWorkModal${_work.index}">
            View Info
          </a>
        
        <!-- only show Buy button if owner sells copyright licenses and if viewer isn't the owner-->
          <a class="btn btn-lg btn-outline-greenblue buyBtn fs-6 p-3 ${
            (!_work.selling || currentViewer || Cookies.get(_work.index)) &&
            "d-none"
          }" id=${_work.index}>
            Buy for ${_work.price.shiftedBy(-ERC20_DECIMALS).toFixed(2)} cUSD
          </a>
          
          <!-- show delete button if current viewer is the owner -->
          <a class="btn btn-lg btn-outline-danger deleteBtn fs-6 p-3 ${
            !currentViewer && "d-none"
          }" id=${_work.index}>
            Delete Work
          </a>
          
        </div>
      </div>
    </div>
    
    <!-- View Work Modal -->
    <div class="modal fade" id="viewWorkModal${
      _work.index
    }" tabindex="-1" aria-labelledby="viewWorkModalLabel" aria-hidden="false">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="viewWorkModalLabel">Work Inforomation</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div>
              <small>Owner's Address</small>
              <p>
                <a class="text-truncate text-info d-inline-block" style="max-width: 330px" href="${celoExplorer}/address/${
    _work.owner
  }/transactions" target="_blank">${celoExplorer}/address/${
    _work.owner
  }/transactions</a>
              </p>
            </div>
            
            <div>
             <small>Copyright Certificate</small>
             <p>
              <a class="text-truncate text-info d-inline-block" style="max-width: 330px" href="${celoExplorer}/token/${
    _work.licenseTokenAddr
  }/token-transfers">${celoExplorer}/token/${
    _work.licenseTokenAddr
  }/token-transfers</a>
             </p>
            </div>
            
            <div>
              <small>Protected By                 <b><em>Smart~Copy</em></b></small>
              <p class="mt-0 fs-6">
                All rights reserved!
              </p>
            </div>
            
            <div class="${!_work.selling && "d-none"}">
              <h6>Terms of Use</h6>
              
              <div class="border border-dark p-3">
                ${_work.terms}
                
                <div class="border border-3 border-grb shadow p-1 text-center ${
                  !_work.selling && "d-none"
                }">
                  Copyright Licenses are issued at a price of <br /> <strong class="text-greenblue fs-5">${_work.price
                    .shiftedBy(-ERC20_DECIMALS)
                    .toFixed(2)} cUSD</strong>
                </div>
              </div>
            </div>
            
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Close</button>
             <a
              class="btn btn-outline-greenblue buyBtn fs-6  ${
                (!_work.selling || currentViewer) && "d-none"
              }"
              data-bs-dismiss="modal"
              id="${_work.index}"
            >
              Buy for <strong>${_work.price
                .shiftedBy(-ERC20_DECIMALS)
                .toFixed(2)} cUSD</strong>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function identiconTemplate(_address) {
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL();

  return `
  <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
    <a href="${celoExplorer}/address/${_address}/transactions"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}">
    </a>
  </div>
  `;
}

function notification(_text) {
  document.querySelector(".alert").style.display = "block";
  document.querySelector("#notification").textContent = _text;
}

function notificationOff() {
  document.querySelector(".alert").style.display = "none";
}

function startCookieTimer() {
  // all available cookies
  let cookieLicenses = Cookies.get();

  // the available cookie id's
  let cookieIds = Object.keys(cookieLicenses);

  let newLicenses = licenses.filter((license) =>
    cookieIds.includes(license.workIndex.toString())
  );

  // retrieve the licenses with latest issued date/time
  if (newLicenses.length > 0) {
    

    let cookieOfInterest = Math.max(...newLicenses.map((x) => x.issuedOn));

    let licenseOfInterest = newLicenses.filter(
      (newLicense) => newLicense.issuedOn === cookieOfInterest
    )[0];

    licensesOfInterest.push(licenseOfInterest);

    interestCount = licensesOfInterest.length;
  }
}

// alternate way of removing a license
function popLicense(workIndex) {
  return licensesOfInterest.filter(
    (license) => license.workIndex !== workIndex
  );
}

// remove a license using smart contract methods
// => doesn't work since timestamp of the contract is
// backward to that of Javascript
async function removeLicense(license) {
  notification(
    `⌛ ℹ️ Removing License for "${works[license.workIndex].name}"...`
  );

  try {
    await contract.methods
      .removeLicense(license.index, license.workIndex)
      .send({ from: kit.defaultAccount });

    notification(`🎉 License successfully removed "${works[index].name}".`);
  } catch (error) {
    notification(`⚠️ ${error}.`);
  }
}

// inform cUSD contract about the current transaction
async function approve(price) {
  const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress);

  return await cUSDContract.methods
    .approve(MPContractAddress, price)
    .send({ from: kit.defaultAccount });

  
}

window.addEventListener("load", async () => {
  notification("⌛ Loading...");
  await connectCeloWallet();
  await getBalance();
  await getWorks();
  await getLicenses();
  startCookieTimer();
  notificationOff();
});

// load up work details once a work is selected for edit
selectForm.addEventListener("change", function () {
  editDiv.style.display = "block";
  

  selectedWork = works[parseInt(this.value)];

  // set appropriate fields
  editWorkName.value = selectedWork.name;
  editImageUrl.value = selectedWork.image;
  editWorkDesc.value = selectedWork.description;
  editSelling.checked = selectedWork.selling;
  editPrice.value = selectedWork.price.shiftedBy(-ERC20_DECIMALS).toFixed(2);

  // display editor if selling is true
  if (editSelling.checked) {
    richTextEditor2.style.display = "block";
    priceInput2.style.display = "block";
  } else {
    richTextEditor2.style.display = "none";
    priceInput2.style.display = "none";
  }

  editor2.root.innerHTML = selectedWork.terms;
});

// add a new work
document.querySelector("#newWorkBtn").addEventListener("click", async (e) => {
  let isSelling = document.getElementById("selling").checked;
  const params = [
    [
      document.getElementById("newWorkName").value,
      document.getElementById("newImgUrl").value,
      document.getElementById("newWorkDescription").value,
      isSelling ? editor.root.innerHTML : "",
    ],
    isSelling
      ? new BigNumber(document.getElementById("newPrice").value.toString())
          .shiftedBy(ERC20_DECIMALS)
          .toString()
      : new BigNumber(0).shiftedBy(ERC20_DECIMALS).toString(),
    isSelling,
  ];
  notification(`⌛ Adding "${params[0][0]}"...`);
  try {
    const result = await contract.methods
      .createWork(...params)
      .send({ from: kit.defaultAccount });
    notification(`🎉 You successfully added "${params[0][0]}".`);
    getWorks();

    setTimeout(() => {
      notificationOff();
    }, 5000);
  } catch (error) {
    notification(`⚠️ ${error}.`);
  }
});

// update work
document
  .querySelector("#updateWorkBtn")
  .addEventListener("click", async (e) => {
    if (selectedWork) {
      let isSelling = document.getElementById("editSelling").checked;
      const params = [
        selectedWork.index,
        [
          document.getElementById("editWorkName").value,
          document.getElementById("editImgUrl").value,
          document.getElementById("editWorkDescription").value,
          isSelling ? editor2.root.innerHTML : "",
        ],

        isSelling
          ? new BigNumber(document.getElementById("editPrice").value.toString())
              .shiftedBy(ERC20_DECIMALS)
              .toString()
          : new BigNumber(0).shiftedBy(ERC20_DECIMALS).toString(),

        isSelling,
      ];
      notification(`⌛ Updating "${params[1][0]}"...`);
      try {
        const result = await contract.methods
          .updateWork(...params)
          .send({ from: kit.defaultAccount });
        notification(`🎉 You successfully updated "${params[1][0]}".`);

        resetSelect();
        getWorks();

        setTimeout(() => {
          notificationOff();
        }, 8000);
      } catch (error) {
        notification(`⚠️ ${error}.`);
      }
    }
  });

// delete a work
document.querySelector("#marketplace").addEventListener("click", async (e) => {
  if (e.target.className.includes("deleteBtn")) {
    let confirmed = confirm("Sure you want to delete?");

    if (confirmed) {
      const index = e.target.id;

      notification("⌛ Delete work in progress...");

      try {
        if (parseInt(works[index].licenseCount) == 0) {
          const response = await contract.methods
            .deleteWork(index)
            .send({ from: kit.defaultAccount });

          notification(`🎉 You successfully deleted "${works[index].name}".`);
          getWorks();
          getBalance();

          setTimeout(() => {
            notificationOff();
          }, 5000);

          return;
        } else {
          
          setTimeout(() => {
            notification(
              `Sorry, you can't delete this work as lts license is currently in use.`
            );
          }, 15000);
        }
      } catch (error) {
        notification(`⚠️ ${error}.`);
      }
    }
  }
});

// buy work license
document.querySelector("#marketplace").addEventListener("click", async (e) => {
  if (e.target.className.includes("buyBtn")) {
    const index = e.target.id;
    notification("⌛ Waiting for payment approval...");

    try {
      await approve(works[index].price);
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }

    notification(`⌛ Awaiting payment for "${works[index].name}"...`);

    try {
      await contract.methods
        .buyWorkLicense(index)
        .send({ from: kit.defaultAccount });

      Cookies.set(works[index].index, works[index].name, {
        expires: 0.000694444, // for 1 minute
        // expires: 0.00347222, // for 5 minutes => could be changed to a month
      });

      notification(`🎉 You successfully bought "${works[index].name}".`);
      getWorks();
      getBalance();

      getLicenses();

      startCookieTimer(works[index]);

      setTimeout(() => {
        notificationOff();
        browserNotification(works[index]);
      }, 5000);
    } catch (error) {
      notification(`⚠️ ${error}.`);
    }
  }
});

// Display Browser Notification
let bNotification;
function browserNotification(work) {
  if(!notifyPermGranted){
    return  alert("License set for 2 minutes");
  }
    bNotification = new Notification(work.name, {
      body: "License set for 2 minutes",
      data: { exp: work.index },
      tag: work.index,
    });

    bNotification.addEventListener("error", (e) => {
      alert("Notification not Granted");
    });
  
}

// request Notification permission
Notification.requestPermission().then((perm) => {
  if (perm === "granted") {
    notifyPermGranted = true;

    const bNotification = new Notification("Welcome message", {
      body: "Welcome",
      tag: "Welcome",
    });
    return
  } 
  notifyPermGranted = false;

});

// should continuously check if the user buys any licenses
// checks if cookie license is set
setInterval(() => {
  if (licensesOfInterest.length > 0) {
    licensesOfInterest.forEach((license) => {
      // timesout on any expired license
      setTimeout(() => {
        // the time set by the contract never equals Date.now,
        // so I opted to check only the cookies
        if (
          // !license.expired &&
          !Cookies.get(license.workIndex)
          // license.expiresOn == Date.now()
        ) {
          

          licensesOfInterest = popLicense(license.workIndex);
        }
      }, 60000);
    });
  }
}, 10000);

// check if the latest purchased license has expired
// and reload
setInterval(() => {
  if (interestCount - 1 === licensesOfInterest.length) {
    interestCount--;
    

    location.reload();
  } 
}, 1000);
