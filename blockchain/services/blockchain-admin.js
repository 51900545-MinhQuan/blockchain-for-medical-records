// File xử lý các transaction với ví admin

const { ethers } = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

// Khởi tạo provider và wallet từ khóa riêng tư của admin
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const CONTRACT_ADDR = process.env.CONTRACT_ADDR;

const CONTRACT_ABI = [
  "function assignDoctor(bytes32 _doctorCode, address _wallet) public",
  "function assignPatient(bytes32 _patientCode, address _wallet) public",
  "function linkGuardianToPatient(bytes32 _patientCode, address _guardianWallet) public",
  "function hasAccess(bytes32 _patientCode, bytes32 _recordCode, bytes32 _doctorCode) public view returns (bool)",
  "function verifyRecord(bytes32 _recordCode, bytes32 _recordHash) public view returns (bool)",
  "function getRecordHash(bytes32 _recordCode) public view returns (bytes32)",
  "event DoctorAssigned(bytes32 indexed doctorCode, address indexed wallet)",
  "event PatientAssigned(bytes32 indexed patientCode, address indexed wallet)",
  "event GuardianLinked(bytes32 indexed patientCode, address indexed wallet)",
];

const contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, wallet);

async function assignDoctor(doctorCode, walletAddress) {
  try {
    const doctorCodeBytes32 = ethers.encodeBytes32String(doctorCode);

    console.log(
      `Liên kết bác sĩ trên chuỗi: Mã=${doctorCode} (${doctorCodeBytes32}), Ví=${walletAddress}`
    );
    const tx = await contract.assignDoctor(doctorCodeBytes32, walletAddress);
    return { success: true };
  } catch (error) {
    const errorMessage = error.shortMessage;
    console.error("Lỗi khi giao dịch assignDoctor:", errorMessage);
    throw error;
  }
}

async function assignPatient(patientCode, walletAddress) {
  try {
    const patientCodeBytes32 = ethers.encodeBytes32String(patientCode);

    console.log(
      `Liên kết bệnh nhân trên chuỗi: Mã=${patientCode} (${patientCodeBytes32}), Ví=${walletAddress}`
    );
    const tx = await contract.assignPatient(patientCodeBytes32, walletAddress);
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi giao dịch assignPatient:", error.shortMessage);
    throw error;
  }
}

async function linkGuardianToPatient(patientCode, guardianWallet) {
  try {
    const patientCodeBytes32 = ethers.encodeBytes32String(patientCode);

    console.log(
      `Liên kết người giám hộ trên chuỗi: Bệnh nhân Mã=${patientCode} (${patientCodeBytes32}), Ví người giám hộ=${guardianWallet}`
    );
    const tx = await contract.linkGuardianToPatient(
      patientCodeBytes32,
      guardianWallet
    );
    return { success: true };
  } catch (error) {
    console.error(
      "Lỗi khi giao dịch linkGuardianToPatient:",
      error.shortMessage
    );
    throw error;
  }
}

async function checkRecordAccess(patientCode, recordCode, doctorCode) {
  try {
    const patientCodeBytes32 = ethers.encodeBytes32String(patientCode);
    const recordCodeBytes32 = ethers.encodeBytes32String(recordCode);
    const doctorCodeBytes32 = ethers.encodeBytes32String(doctorCode);

    const hasAccess = await contract.hasAccess(
      patientCodeBytes32,
      recordCodeBytes32,
      doctorCodeBytes32
    );
    return hasAccess;
  } catch (error) {
    console.error(
      `Blockchain kiểm tra quyền truy cập thất bại cho Bác sĩ ${doctorCode}, Bệnh nhân ${patientCode}, Bệnh án ${recordCode}:`,
      error.message
    );
    return false;
  }
}

async function getRecordHash(recordCode) {
  try {
    const recordCodeBytes32 = ethers.encodeBytes32String(recordCode);
    const recordHash = await contract.getRecordHash(recordCodeBytes32);
    return recordHash;
  } catch (error) {
    console.error("Lỗi khi lấy hash bệnh án từ blockchain:", error);
    return null;
  } 
}

async function verifyRecordIntegrity(recordCode, recordHash) {
  try {
    const recordCodeBytes32 = ethers.encodeBytes32String(recordCode);

    const isValid = await contract.verifyRecord(recordCodeBytes32, recordHash);
    return isValid;
  } catch (error) {
    console.error("Lỗi khi kiểm tra tính toàn vẹn trên blockchain:", error);
    return false;
  }
}

module.exports = {
  assignDoctor,
  assignPatient,
  linkGuardianToPatient,
  checkRecordAccess,
  getRecordHash,
  verifyRecordIntegrity,
};
