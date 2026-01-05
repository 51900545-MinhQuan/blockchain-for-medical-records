// File lắng nghe các event từ blockchain và ghi vào database

const { ethers } = require("ethers");
const UserModel = require("../../models/user.js");
const AdminLogModel = require("../../models/admin-logs.js");
const dotenv = require("dotenv");
const { locale } = require("moment");
dotenv.config();

const CONTRACT_ADDR = process.env.CONTRACT_ADDR;
const WEBSOCKET_PROVIDER_URL = process.env.WEBSOCKET_PROVIDER_URL;

const CONTRACT_ABI = [
  "event RecordAdded(bytes32 indexed recordCode, bytes32 indexed recordHash, address indexed doctor, uint256 timestamp)",
  "event RecordUpdated(bytes32 indexed recordCode, bytes32 indexed recordHash, address indexed doctor, uint256 timestamp)",
  "event AccessGranted(bytes32 indexed patientCode, bytes32 recordCode, bytes32 indexed doctorCode, uint256 timestamp)",
  "event AccessRevoked(bytes32 indexed patientCode, bytes32 recordCode, bytes32 indexed doctorCode, uint256 timestamp)",
  "event AccessAttempt(bytes32 indexed recordCode, bytes32 indexed doctorCode, bool accessGranted, uint256 timestamp)",
  "event RecordHashUpdatedByAdmin(bytes32 indexed recordCode, bytes32 indexed recordHash, address indexed wallet, uint256 timestamp)",
];

function startEventListener() {
  console.log("Bắt đầu lắng nghe event từ contract...");

  if (!WEBSOCKET_PROVIDER_URL) {
    console.error("WEBSOCKET_PROVIDER_URL chưa có.");
    process.exit(1);
  }

  const provider = new ethers.WebSocketProvider(WEBSOCKET_PROVIDER_URL);
  const contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, provider);

  provider.on("error", (err) => {
    console.error("Websocket Error:", err);
  });

  contract.on(
    "RecordAdded",
    async (recordCode, recordHash, doctorAddress, timestamp) => {
      const doctor = await UserModel.findOne({
        walletAddress: doctorAddress,
        role: 2,
      });
      await AdminLogModel.create({
        event: "RecordAdded",
        data: {
          recordCode: ethers.decodeBytes32String(recordCode),
          recordHash,
          doctor: doctor
            ? {
                code: doctor.linkedDoctorCode,
                address: doctorAddress,
                fullname: doctor.fullname,
              }
            : { code: "Không có", address: doctorAddress },
          timestamp: toDate(timestamp),
        },
      });
    }
  );
  contract.on(
    "RecordUpdated",
    async (recordCode, recordHash, doctorAddress, timestamp) => {
      const doctor = await UserModel.findOne({
        walletAddress: doctorAddress,
        role: 2,
      });
      await AdminLogModel.create({
        event: "RecordUpdated",
        data: {
          recordCode: ethers.decodeBytes32String(recordCode),
          recordHash,
          doctor: doctor
            ? {
                code: doctor.linkedDoctorCode,
                address: doctorAddress,
                fullname: doctor.fullname,
              }
            : { code: "Không có", address: doctorAddress },
          timestamp: toDate(timestamp),
        },
      });
    }
  );
  contract.on(
    "AccessGranted",
    async (patientCode, recordCode, doctorCode, timestamp) => {
      const decodedDoctorCode = ethers.decodeBytes32String(doctorCode);
      const doctor = await UserModel.findOne({
        linkedDoctorCode: decodedDoctorCode,
        role: 2,
      });
      await AdminLogModel.create({
        event: "AccessGranted",
        data: {
          patientCode: ethers.decodeBytes32String(patientCode),
          recordCode: ethers.decodeBytes32String(recordCode),
          doctor: doctor
            ? { code: decodedDoctorCode, fullname: doctor.fullname }
            : { code: decodedDoctorCode, fullname: "Không có" },
          timestamp: toDate(timestamp),
        },
      });
    }
  );
  contract.on(
    "AccessRevoked",
    async (patientCode, recordCode, doctorCode, timestamp) => {
      const decodedDoctorCode = ethers.decodeBytes32String(doctorCode);
      const doctor = await UserModel.findOne({
        linkedDoctorCode: decodedDoctorCode,
        role: 2,
      });
      await AdminLogModel.create({
        event: "AccessRevoked",
        data: {
          patientCode: ethers.decodeBytes32String(patientCode),
          recordCode: ethers.decodeBytes32String(recordCode),
          doctor: doctor
            ? { code: decodedDoctorCode, fullname: doctor.fullname }
            : { code: decodedDoctorCode, fullname: "Không có" },
          timestamp: toDate(timestamp),
        },
      });
    }
  );
  contract.on(
    "AccessAttempt",
    async (recordCode, doctorCode, accessGranted, timestamp) => {
      const decodedDoctorCode = ethers.decodeBytes32String(doctorCode);
      const doctor = await UserModel.findOne({
        linkedDoctorCode: decodedDoctorCode,
        role: 2,
      });
      await AdminLogModel.create({
        event: "AccessAttempt",
        data: {
          recordCode: ethers.decodeBytes32String(recordCode),
          doctor: doctor
            ? { code: decodedDoctorCode, fullname: doctor.fullname }
            : { code: decodedDoctorCode, fullname: "Không có" },
          accessGranted,
          timestamp: toDate(timestamp),
        },
      });
    }
  );
  contract.on(
    "RecordHashUpdatedByAdmin",
    async (recordCode, recordHash, walletAddress, timestamp) => {
      await AdminLogModel.create({
        event: "RecordHashUpdatedByAdmin",
        data: {
          recordCode: ethers.decodeBytes32String(recordCode),
          recordHash,
          walletAddress,
          timestamp: toDate(timestamp),
        },
      });
    }
  );
}

function toDate(timestamp) {
  convertedTimestamp = Number(timestamp) * 1000;
  let date = new Date(convertedTimestamp);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

module.exports = startEventListener;
