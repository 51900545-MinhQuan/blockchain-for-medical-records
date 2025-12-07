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
  "event DoctorAssigned(bytes32 indexed doctorCode, address indexed wallet)",
  "event PatientAssigned(bytes32 indexed patientCode, address indexed wallet)",
  "event GuardianLinked(bytes32 indexed patientCode, address indexed wallet)",
];

const contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, wallet);

async function assignDoctor(doctorCode, walletAddress) {
  try {
    const doctorCodeBytes32 = ethers.encodeBytes32String(doctorCode);

    console.log(
      `Assigning doctor on-chain: Code=${doctorCode} (${doctorCodeBytes32}), Wallet=${walletAddress}`
    );
    const tx = await contract.assignDoctor(doctorCodeBytes32, walletAddress);
    return { success: true };
  } catch (error) {
    const errorMessage = error.shortMessage;
    console.error("Error in assignDoctor transaction:", errorMessage);
    throw error;
  }
}

async function assignPatient(patientCode, walletAddress) {
  try {
    const patientCodeBytes32 = ethers.encodeBytes32String(patientCode);

    console.log(
      `Assigning patient on-chain: Code=${patientCode} (${patientCodeBytes32}), Wallet=${walletAddress}`
    );
    const tx = await contract.assignPatient(patientCodeBytes32, walletAddress);
    return { success: true };
  } catch (error) {
    console.error("Error in assignPatient transaction:", error.shortMessage);
    throw error;
  }
}

async function linkGuardianToPatient(patientCode, guardianWallet) {
  try {
    const patientCodeBytes32 = ethers.encodeBytes32String(patientCode);

    console.log(
      `Linking guardian to patient on-chain: PatientCode=${patientCode} (${patientCodeBytes32}), GuardianWallet=${guardianWallet}`
    );
    const tx = await contract.linkGuardianToPatient(
      patientCodeBytes32,
      guardianWallet
    );
    return { success: true };
  } catch (error) {
    console.error(
      "Error in linkGuardianToPatient transaction:",
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

module.exports = {
  assignDoctor,
  assignPatient,
  linkGuardianToPatient,
  checkRecordAccess,
};
