const CONTRACT_ABI = [
  "function addRecord(bytes32 _recordCode, bytes32 _patientCode, bytes32 _recordHash) public",
  "function updateRecord(bytes32 _recordCode, bytes32 _patientCode, bytes32 _recordHash) public",
  "function grantAccess(bytes32 _patientCode, bytes32 _recordCode, bytes32 _doctorCode) public",
  "function revokeAccess(bytes32 _patientCode, bytes32 _recordCode, bytes32 _doctorCode) public",
  "function hasAccess(bytes32 _patientCode, bytes32 _recordCode, bytes32 _doctorCode) public view returns (bool)",
  "event RecordAdded(bytes32 indexed recordCode, bytes32 indexed recordHash, address indexed doctor, uint256 timestamp)",
  "event RecordUpdated(bytes32 indexed recordCode, bytes32 indexed recordHash, address indexed doctor, uint256 timestamp)",
  "event AccessGranted(bytes32 indexed patientCode, bytes32 recordCode, bytes32 indexed doctorCode, uint256 timestamp)",
  "event AccessRevoked(bytes32 indexed patientCode, bytes32 recordCode, bytes32 indexed doctorCode, uint256 timestamp)",
];

/**
 * Kiểm tra ví trình duyệt (như MetaMask) và trả về một instance hợp đồng.
 * @param {boolean} withSigner - Nếu true, trả về hợp đồng với signer để ký giao dịch.
 * @returns {ethers.Contract | null} - Một instance hợp đồng hoặc null nếu không tìm thấy ví.
 */
async function getContract(withSigner = false) {
  if (withSigner) {
    const { signer } = await connectWallet(true);
    if (signer) {
      return new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);
    } else {
      return null;
    }
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, provider);
}

/**
 * Kết nối ví và trả về địa chỉ ví
 * @returns {Promise<{provider: ethers.BrowserProvider | null, signer: ethers.JsonRpcSigner | null, address: string | null}>}
 */
async function connectWallet(requestSigner = true) {
  if (typeof window.ethereum === "undefined") {
    toastr.warning("Vui lòng cài đặt MetaMask");
    return { provider: null, signer: null, address: null };
  }

  try {
    // Kiểm tra và chuyển sang mạng Polygon
    const currentChain = await window.ethereum.request({
      method: "eth_chainId",
    });
    if (currentChain !== POLYGON_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: POLYGON_CHAIN_ID }],
        });
        console.log("Chuyển mạng sang Polygon Amoy testnet");
      } catch (switchError) {
        // Nếu Polygon chưa được thêm, thêm mới
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: POLYGON_CHAIN_ID,
                chainName: "Polygon Amoy",
                nativeCurrency: {
                  name: "Polygon",
                  symbol: "POL",
                  decimals: 18,
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ["https://polygonscan.com/"],
              },
            ],
          });
        } else {
          console.error("Lỗi khi chuyển mạng:", switchError);
          toastr.warning("Lỗi khi chuyển mạng");
          return { provider: null, signer: null, address: null };
        }
      }
    }
  } catch (error) {
    console.error("Lỗi khi chuyển mạng:", error);
    return { provider: null, signer: null, address: null };
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  if (!requestSigner) {
    return { provider, signer: null, address: null };
  }

  try {
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const walletAddress = await signer.getAddress();
    return { provider, signer, address: walletAddress };
  } catch (error) {
    console.error("Client từ chối quyền truy cập:", error);
    toastr.warning("Vui lòng cấp quyền truy cập ví MetaMask");
    return { provider, signer: null, address: null };
  }
}

/**
 * Bệnh nhân cấp quyền truy cập hồ sơ bệnh án cho bác sĩ
 * Yêu cầu bệnh nhân ký giao dịch bằng ví MetaMask của họ
 * @param {string} patientCode - Mã bệnh nhân
 * @param {string} recordCode - Mã hồ sơ bệnh án
 * @param {string} doctorCode - Mã bác sĩ
 * @returns {Promise<boolean>} - Trả về true nếu giao dịch blockchain thành công, false nếu thất bại hoặc bị từ chối.
 */
async function grantAccessToDoctor(patientCode, recordCode, doctorCode) {
  const contract = await getContract(true);
  if (!contract) return false;

  const bytesPatientCode = ethers.encodeBytes32String(patientCode);
  const bytesRecordCode = ethers.encodeBytes32String(recordCode);
  const bytesDoctorCode = ethers.encodeBytes32String(doctorCode);

  try {
    toastr.info(
      "Vui lòng xác nhận giao dịch trong ví MetaMask để cấp quyền truy cập trên Blockchain."
    );

    const tx = await contract.grantAccess(
      bytesPatientCode,
      bytesRecordCode,
      bytesDoctorCode
    );

    toastr.info("Đang chờ xác nhận giao dịch từ Blockchain...", "Đang xử lý");

    await tx.wait();
    return true;
  } catch (error) {
    console.error("Lỗi khi cấp quyền trên blockchain:", error);
    if (error.code === "ACTION_REJECTED") {
      toastr.warning(
        "Bạn đã từ chối giao dịch. Quyền truy cập chưa được ghi lên blockchain."
      );
    } else {
      toastr.error("Đã xảy ra lỗi khi cấp quyền truy cập trên blockchain.");
    }
    return false;
  }
}

/**
 * Bệnh nhân thu hồi quyền truy cập hồ sơ bệnh án từ bác sĩ
 * Yêu cầu bệnh nhân ký giao dịch bằng ví MetaMask của họ
 * @param {string} patientCode - Mã bệnh nhân
 * @param {string} recordCode - Mã hồ sơ bệnh án
 * @param {string} doctorCode - Mã bác sĩ
 * @returns {Promise<boolean>} - Trả về true nếu giao dịch blockchain thành công, false nếu thất bại hoặc bị từ chối.
 */
async function revokeAccessFromDoctor(patientCode, recordCode, doctorCode) {
  const contract = await getContract(true);
  if (!contract) return false;

  const bytesPatientCode = ethers.encodeBytes32String(patientCode);
  const bytesRecordCode = ethers.encodeBytes32String(recordCode);
  const bytesDoctorCode = ethers.encodeBytes32String(doctorCode);

  try {
    toastr.info(
      "Vui lòng xác nhận giao dịch trong ví MetaMask để thu hồi quyền truy cập trên Blockchain."
    );

    const tx = await contract.revokeAccess(
      bytesPatientCode,
      bytesRecordCode,
      bytesDoctorCode
    );

    toastr.info("Đang chờ xác nhận giao dịch từ Blockchain...", "Đang xử lý");

    await tx.wait();
    return true;
  } catch (error) {
    console.error("Lỗi khi thu hồi quyền trên blockchain:", error);
    if (error.code === "ACTION_REJECTED") {
      toastr.warning(
        "Bạn đã từ chối giao dịch. Quyền truy cập chưa được thu hồi."
      );
    } else {
      toastr.error("Đã xảy ra lỗi khi thu hồi quyền truy cập trên blockchain.");
    }
    return false;
  }
}

/**
 * Bác sĩ thêm hồ sơ bệnh án cho bệnh nhân
 * Yêu cầu bác sĩ ký giao dịch bằng ví MetaMask của họ
 * @param {string} recordId - ID hồ sơ bệnh án
 * @param {string} recordCode - Mã hồ sơ bệnh án
 * @param {string} patientCode - Mã bệnh nhân
 * @param {string} recordHash - Hash của dữ liệu bệnh án, được tạo từ server.
 * @returns {Promise<boolean>} - Trả về true nếu thành công, false nếu thất bại.
 */
async function addRecordByDoctor(
  recordId,
  recordCode,
  patientCode,
  recordHash
) {
  const contract = await getContract(true);
  if (!contract) return false;

  const bytesRecordCode = ethers.encodeBytes32String(recordCode);
  const bytesPatientCode = ethers.encodeBytes32String(patientCode);

  try {
    toastr.info(
      "Vui lòng xác nhận giao dịch trong ví MetaMask để lưu bệnh án lên Blockchain."
    );
    const tx = await contract.addRecord(
      bytesRecordCode,
      bytesPatientCode,
      recordHash
    );

    toastr.info("Đang chờ xác nhận giao dịch từ Blockchain...", "Đang xử lý");

    await tx.wait();

    const response = await fetch("/doctor/medical-records/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordId: recordId }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    return true;
  } catch (error) {
    console.error(
      "Lỗi khi thêm bệnh án vào blockchain:",
      error.code,
      error.message
    );
    if (error.code === "ACTION_REJECTED") {
      toastr.warning(
        "Bạn đã từ chối giao dịch. Bệnh án chưa được ghi lên blockchain."
      );
    } else {
      toastr.error("Đã xảy ra lỗi khi ghi bệnh án lên blockchain.");
    }
    return false;
  }
}

/**
 * Bác sĩ cập nhật hồ sơ bệnh án cho bệnh nhân trên blockchain.
 * @param {string} recordId - ID hồ sơ bệnh án
 * @param {string} recordCode - Mã hồ sơ bệnh án.
 * @param {string} patientCode - Mã bệnh nhân.
 * @param {string} newRecordHash - Hash mới của dữ liệu bệnh án.
 * @returns {Promise<boolean>} - Trả về true nếu thành công, false nếu thất bại.
 */
async function updateRecordByDoctor(
  recordId,
  recordCode,
  patientCode,
  newRecordHash
) {
  const contract = await getContract(true);
  if (!contract) return false;

  const bytesRecordCode = ethers.encodeBytes32String(recordCode);
  const bytesPatientCode = ethers.encodeBytes32String(patientCode);

  try {
    toastr.info(
      "Vui lòng xác nhận giao dịch trong ví MetaMask để cập nhật bệnh án trên Blockchain."
    );

    const tx = await contract.updateRecord(
      bytesRecordCode,
      bytesPatientCode,
      newRecordHash
    );

    toastr.info("Đang chờ xác nhận cập nhật từ Blockchain...", "Đang xử lý");

    await tx.wait();

    const response = await fetch("/doctor/medical-records/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordId: recordId }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    return true;
  } catch (error) {
    console.error("Lỗi khi cập nhật bệnh án trên blockchain:", error);
    if (error.code === "ACTION_REJECTED") {
      toastr.warning("Bạn đã từ chối giao dịch cập nhật.");
    } else {
      toastr.error("Đã xảy ra lỗi khi cập nhật bệnh án trên blockchain.");
    }
    return false;
  }
}
/**
 * Bác sĩ kiểm tra quyền truy cập hồ sơ bệnh án của mình trên blockchain.
 * @param {string} patientCode - Mã bệnh nhân
 * @param {string} recordCode - Mã hồ sơ bệnh án
 * @param {string} doctorCode - Mã bác sĩ
 * @returns {Promise<boolean>} - Trả về true nếu có quyền truy cập, false nếu không có hoặc lỗi.
 */
async function hasAccessToThisRecord(patientCode, recordCode, doctorCode) {
  const contract = await getContract(false);
  if (!contract) return false;
  const bytesPatientCode = ethers.encodeBytes32String(patientCode);
  const bytesRecordCode = ethers.encodeBytes32String(recordCode);
  const bytesDoctorCode = ethers.encodeBytes32String(doctorCode);
  try {
    const access = await contract.hasAccess(
      bytesPatientCode,
      bytesRecordCode,
      bytesDoctorCode
    );
    return access;
  } catch (error) {
    console.error("Lỗi khi kiểm tra quyền truy cập trên blockchain:", error);
    return false;
  }
}
