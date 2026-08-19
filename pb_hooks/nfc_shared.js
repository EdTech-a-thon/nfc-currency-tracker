// Helpers shared by the classroom currency routes in nfc.pb.js.
// Balances are always derived from the transactions ledger; nothing caches them.

const CARD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function balance(app, studentId) {
  const rows = app.findRecordsByFilter("transactions", "student = {:student}", "", 0, 0, { student: studentId });
  let total = 0;
  for (const row of rows) total += row.getInt("amount");
  return total;
}

function ownedStudent(app, teacherId, studentId, mustBeActive) {
  let student;
  try {
    student = app.findFirstRecordByFilter("students", "id = {:id} && teacher = {:teacher}", {
      id: studentId, teacher: teacherId,
    });
  } catch (_) {
    throw new BadRequestError("Student not found.");
  }
  if (mustBeActive && !student.getBool("active")) throw new BadRequestError("Student not found.");
  return student;
}

function ownedClassroom(app, teacherId, classroomId, mustBeOpen) {
  if (!classroomId) throw new BadRequestError("That student is not in a class yet.");
  let classroom;
  try {
    classroom = app.findFirstRecordByFilter("classrooms", "id = {:id} && teacher = {:teacher}", {
      id: classroomId, teacher: teacherId,
    });
  } catch (_) {
    throw new BadRequestError("Classroom not found.");
  }
  if (mustBeOpen && classroom.getBool("archived")) {
    throw new BadRequestError("This classroom is archived or unavailable.");
  }
  return classroom;
}

// Returns the existing transaction for this key, so a retried request is a no-op.
function alreadyPosted(app, teacherId, idempotencyKey) {
  try {
    return app.findFirstRecordByFilter("transactions", "createdBy = {:teacher} && idempotencyKey = {:key}", {
      teacher: teacherId, key: idempotencyKey,
    });
  } catch (_) {
    return null;
  }
}

function saveTransaction(app, values) {
  const record = new Record(app.findCollectionByNameOrId("transactions"));
  record.set("student", values.student);
  record.set("classroom", values.classroom);
  record.set("amount", values.amount);
  record.set("reason", String(values.reason).slice(0, 200));
  record.set("kind", values.kind);
  record.set("createdBy", values.createdBy);
  record.set("idempotencyKey", values.idempotencyKey);
  if (values.storeItem) record.set("storeItem", values.storeItem);
  app.save(record);
  return record;
}

// Ends every open assignment matching the filter and frees the cards behind them.
function releaseAssignments(app, filter, params) {
  const open = app.findRecordsByFilter("card_assignments", filter, "", 0, 0, params);
  const now = new DateTime();
  for (const assignment of open) {
    assignment.set("endedAt", now);
    app.save(assignment);
    const card = app.findRecordById("cards", assignment.getString("card"));
    if (card.getString("status") === "ASSIGNED") {
      card.set("status", "AVAILABLE");
      app.save(card);
    }
  }
  return open.length;
}

function requirePositiveInt(value, message) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new BadRequestError(message);
  return number;
}

function trimmedText(value, fallback) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  return text || fallback;
}

module.exports = {
  CARD_ALPHABET, balance, ownedStudent, ownedClassroom, alreadyPosted,
  saveTransaction, releaseAssignments, requirePositiveInt, trimmedText,
};
