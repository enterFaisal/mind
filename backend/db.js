const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "mindbridge.json");

const ROLES = {
  ADMIN: "ADMIN",
  DOCTOR: "DOCTOR",
  PATIENT: "PATIENT",
};

function createInitialState() {
  return {
    schema: {
      User: {
        id: "10-digit numeric string",
        name: "String",
        role: "ADMIN | DOCTOR | PATIENT",
      },
      Log: {
        id: "String/UUID",
        patientId: "Foreign Key -> User.id",
        timestamp: "ISO Date String",
        type: "text | voice",
        userText: "String",
        companion_reply: "String",
        patient_sentiment: "String",
        crisis_risk_level: "String",
        escalation_alert: "Boolean",
        clinical_summary: "String",
      },
    },
    users: [
      {
        id: process.env.SEED_ADMIN_ID || "1000000000",
        name: process.env.SEED_ADMIN_NAME || "MindBridge Admin",
        role: ROLES.ADMIN,
      },
    ],
    logs: [],
  };
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    writeData(createInitialState());
  }
}

function readData() {
  ensureDatabase();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const data = JSON.parse(raw);
  data.users ||= [];
  data.logs ||= [];
  return data;
}

function writeData(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUserById(id) {
  if (!id) return null;
  return readData().users.find((user) => user.id === id) || null;
}

function getUsers() {
  return readData().users;
}

function normalizeUserId(id) {
  return String(id || "").trim();
}

function validateUserId(id) {
  return /^\d{10}$/.test(id);
}

function createUser({ id, name, role }) {
  const normalizedRole = String(role || "").toUpperCase();
  if (![ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT].includes(normalizedRole)) {
    throw new Error("Invalid user role");
  }

  const normalizedId = normalizeUserId(id);
  if (!validateUserId(normalizedId)) {
    throw new Error("User ID must be exactly 10 numbers");
  }

  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("User name is required");
  }

  const data = readData();
  if (data.users.some((user) => user.id === normalizedId)) {
    throw new Error("A user with this ID already exists");
  }

  const user = {
    id: normalizedId,
    name: trimmedName,
    role: normalizedRole,
  };

  data.users.push(user);
  writeData(data);
  return user;
}

function deleteUser(id) {
  const normalizedId = normalizeUserId(id);
  const data = readData();
  const user = data.users.find((item) => item.id === normalizedId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === ROLES.ADMIN) {
    throw new Error("Admin users cannot be deleted");
  }

  data.users = data.users.filter((item) => item.id !== normalizedId);

  if (user.role === ROLES.PATIENT) {
    data.logs = data.logs.filter((log) => log.patientId !== normalizedId);
  }

  writeData(data);
  return user;
}

function getLogsByPatientId(patientId) {
  return readData()
    .logs.filter((log) => log.patientId === patientId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getLogs() {
  return readData().logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function createLog(log) {
  const data = readData();
  const savedLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: log.type,
    patientId: log.patientId,
    userText: log.userText,
    companion_reply: log.companion_reply || "",
    patient_sentiment: log.patient_sentiment || "Unknown",
    crisis_risk_level: log.crisis_risk_level || "Low",
    escalation_alert: Boolean(log.escalation_alert),
    clinical_summary: log.clinical_summary || "",
  };

  data.logs.push(savedLog);
  writeData(data);
  return savedLog;
}

ensureDatabase();

module.exports = {
  ROLES,
  DB_FILE,
  createUser,
  deleteUser,
  validateUserId,
  getLogs,
  getLogsByPatientId,
  getUserById,
  getUsers,
  createLog,
};
