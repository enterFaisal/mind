const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "mindbridge.sqlite");
const LEGACY_JSON_FILE = path.join(DATA_DIR, "mindbridge.json");

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
        escalation_description: "String",
        escalation_reason: "String",
        recommended_action: "String",
        clinical_summary: "String",
        voice_expressions: "Array<{ name: String, score: Number }>",
        voice_expression_summary: "String",
        voice_expression_error: "String",
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

let database = null;

function getDatabase() {
  ensureDatabase();
  return database;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureDatabase() {
  ensureDataDir();

  if (!database) {
    database = new DatabaseSync(DB_FILE);
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'PATIENT'))
      );

      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        user_text TEXT NOT NULL,
        companion_reply TEXT NOT NULL DEFAULT '',
        patient_sentiment TEXT NOT NULL DEFAULT 'Unknown',
        crisis_risk_level TEXT NOT NULL DEFAULT 'Low',
        escalation_alert INTEGER NOT NULL DEFAULT 0,
        escalation_description TEXT NOT NULL DEFAULT '',
        escalation_reason TEXT NOT NULL DEFAULT '',
        recommended_action TEXT NOT NULL DEFAULT '',
        clinical_summary TEXT NOT NULL DEFAULT '',
        voice_expressions TEXT NOT NULL DEFAULT '[]',
        voice_expression_summary TEXT NOT NULL DEFAULT '',
        voice_expression_error TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_logs_patient_timestamp
        ON logs(patient_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp
        ON logs(timestamp DESC);
    `);

    ensureLogColumn(database, "escalation_description", "TEXT NOT NULL DEFAULT ''");
    ensureLogColumn(database, "escalation_reason", "TEXT NOT NULL DEFAULT ''");
    ensureLogColumn(database, "recommended_action", "TEXT NOT NULL DEFAULT ''");
    migrateLegacyJsonIfNeeded(database);
    seedInitialAdminIfNeeded(database);
  }
}

function ensureLogColumn(db, columnName, columnDefinition) {
  const existingColumns = db.prepare("PRAGMA table_info(logs)").all();
  if (existingColumns.some((column) => column.name === columnName)) return;

  db.exec(`ALTER TABLE logs ADD COLUMN ${columnName} ${columnDefinition}`);
}

function seedInitialAdminIfNeeded(db) {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount > 0) return;

  const seedAdmin = createInitialState().users[0];
  db.prepare("INSERT INTO users (id, name, role) VALUES (?, ?, ?)").run(
    seedAdmin.id,
    seedAdmin.name,
    seedAdmin.role,
  );
}

function migrateLegacyJsonIfNeeded(db) {
  if (!fs.existsSync(LEGACY_JSON_FILE)) return;

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const logCount = db.prepare("SELECT COUNT(*) AS count FROM logs").get().count;
  if (userCount > 0 || logCount > 0) return;

  const raw = fs.readFileSync(LEGACY_JSON_FILE, "utf8");
  const data = JSON.parse(raw);
  const users = Array.isArray(data.users) ? data.users : [];
  const logs = Array.isArray(data.logs) ? data.logs : [];

  const insertUser = db.prepare("INSERT INTO users (id, name, role) VALUES (?, ?, ?)");
  const insertLog = db.prepare(`
    INSERT INTO logs (
      id,
      patient_id,
      timestamp,
      type,
      user_text,
      companion_reply,
      patient_sentiment,
      crisis_risk_level,
      escalation_alert,
      escalation_description,
      escalation_reason,
      recommended_action,
      clinical_summary,
      voice_expressions,
      voice_expression_summary,
      voice_expression_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const user of users) {
      insertUser.run(user.id, user.name, user.role);
    }

    for (const log of logs) {
      insertLog.run(
        log.id || crypto.randomUUID(),
        log.patientId,
        log.timestamp || new Date().toISOString(),
        log.type || "text",
        log.userText || "",
        log.companion_reply || "",
        log.patient_sentiment || "Unknown",
        log.crisis_risk_level || "Low",
        log.escalation_alert ? 1 : 0,
        log.escalation_description || "",
        log.escalation_reason || "",
        log.recommended_action || "",
        log.clinical_summary || "",
        JSON.stringify(Array.isArray(log.voice_expressions) ? log.voice_expressions : []),
        log.voice_expression_summary || "",
        log.voice_expression_error || "",
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
  };
}

function rowToLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    patientId: row.patient_id,
    userText: row.user_text,
    companion_reply: row.companion_reply,
    patient_sentiment: row.patient_sentiment,
    crisis_risk_level: row.crisis_risk_level,
    escalation_alert: Boolean(row.escalation_alert),
    escalation_description: row.escalation_description,
    escalation_reason: row.escalation_reason,
    recommended_action: row.recommended_action,
    clinical_summary: row.clinical_summary,
    voice_expressions: JSON.parse(row.voice_expressions || "[]"),
    voice_expression_summary: row.voice_expression_summary,
    voice_expression_error: row.voice_expression_error,
  };
}

function getUserById(id) {
  if (!id) return null;
  return rowToUser(getDatabase().prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function getUsers() {
  return getDatabase()
    .prepare("SELECT * FROM users ORDER BY role, name COLLATE NOCASE, id")
    .all()
    .map(rowToUser);
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

  if (getUserById(normalizedId)) {
    throw new Error("A user with this ID already exists");
  }

  const user = {
    id: normalizedId,
    name: trimmedName,
    role: normalizedRole,
  };

  getDatabase()
    .prepare("INSERT INTO users (id, name, role) VALUES (?, ?, ?)")
    .run(user.id, user.name, user.role);
  return user;
}

function deleteUser(id) {
  const normalizedId = normalizeUserId(id);
  const user = getUserById(normalizedId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === ROLES.ADMIN) {
    throw new Error("Admin users cannot be deleted");
  }

  getDatabase().prepare("DELETE FROM users WHERE id = ?").run(normalizedId);
  return user;
}

function getLogsByPatientId(patientId) {
  return getDatabase()
    .prepare("SELECT * FROM logs WHERE patient_id = ? ORDER BY timestamp DESC")
    .all(patientId)
    .map(rowToLog);
}

function getRecentLogsByPatientId(patientId, limit = 4) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 4, 12));
  return getDatabase()
    .prepare(
      "SELECT * FROM logs WHERE patient_id = ? ORDER BY timestamp DESC LIMIT ?",
    )
    .all(patientId, safeLimit)
    .map(rowToLog);
}

function getLogs() {
  return getDatabase()
    .prepare("SELECT * FROM logs ORDER BY timestamp DESC")
    .all()
    .map(rowToLog);
}

function createLog(log) {
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
    escalation_description: log.escalation_description || "",
    escalation_reason: log.escalation_reason || "",
    recommended_action: log.recommended_action || "",
    clinical_summary: log.clinical_summary || "",
    voice_expressions: Array.isArray(log.voice_expressions)
      ? log.voice_expressions
      : [],
    voice_expression_summary: log.voice_expression_summary || "",
    voice_expression_error: log.voice_expression_error || "",
  };

  getDatabase()
    .prepare(`
      INSERT INTO logs (
        id,
        patient_id,
        timestamp,
        type,
        user_text,
        companion_reply,
        patient_sentiment,
        crisis_risk_level,
        escalation_alert,
        escalation_description,
        escalation_reason,
        recommended_action,
        clinical_summary,
        voice_expressions,
        voice_expression_summary,
        voice_expression_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      savedLog.id,
      savedLog.patientId,
      savedLog.timestamp,
      savedLog.type,
      savedLog.userText,
      savedLog.companion_reply,
      savedLog.patient_sentiment,
      savedLog.crisis_risk_level,
      savedLog.escalation_alert ? 1 : 0,
      savedLog.escalation_description,
      savedLog.escalation_reason,
      savedLog.recommended_action,
      savedLog.clinical_summary,
      JSON.stringify(savedLog.voice_expressions),
      savedLog.voice_expression_summary,
      savedLog.voice_expression_error,
    );
  return savedLog;
}

function updateLogVoiceExpressions(logId, voiceExpressionData) {
  const existingLog = getDatabase()
    .prepare("SELECT * FROM logs WHERE id = ?")
    .get(logId);
  if (!existingLog) return null;

  getDatabase()
    .prepare(`
      UPDATE logs
      SET
        voice_expressions = ?,
        voice_expression_summary = ?,
        voice_expression_error = ?
      WHERE id = ?
    `)
    .run(
      JSON.stringify(
        Array.isArray(voiceExpressionData.voice_expressions)
          ? voiceExpressionData.voice_expressions
          : [],
      ),
      voiceExpressionData.voice_expression_summary || "",
      voiceExpressionData.voice_expression_error || "",
      logId,
    );

  return rowToLog(
    getDatabase().prepare("SELECT * FROM logs WHERE id = ?").get(logId),
  );
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
  getRecentLogsByPatientId,
  getUserById,
  getUsers,
  createLog,
  updateLogVoiceExpressions,
};
