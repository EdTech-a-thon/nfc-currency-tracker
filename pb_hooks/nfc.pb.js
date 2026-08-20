/// <reference path="../pb_data/types.d.ts" />

// Classroom currency routes. Anything that has to weigh a balance, stay
// atomic, or run without a signed-in account lives here rather than in the
// browser, so the rules cannot be skipped by calling the collections directly.

// Gives a new teacher a starting class with the default award buttons.
onRecordAfterCreateSuccess((e) => {
  const classroom = new Record(e.app.findCollectionByNameOrId("classrooms"));
  classroom.set("teacher", e.record.id);
  classroom.set("name", "My Classroom");
  classroom.set("schoolYear", String(new Date().getFullYear()));
  classroom.set("currencyName", "Class Bucks");
  classroom.set("currencySymbol", "$");
  classroom.set("archived", false);
  e.app.save(classroom);

  const presets = [
    { label: "Great choice", amount: 1, sortOrder: 0 },
    { label: "Helping out", amount: 2, sortOrder: 1 },
    { label: "Above & beyond", amount: 5, sortOrder: 2 },
  ];
  for (const preset of presets) {
    const record = new Record(e.app.findCollectionByNameOrId("award_presets"));
    record.set("classroom", classroom.id);
    record.set("label", preset.label);
    record.set("amount", preset.amount);
    record.set("sortOrder", preset.sortOrder);
    e.app.save(record);
  }
  e.next();
}, "teachers");

// Freeing a student's cards when they are marked inactive.
onRecordAfterUpdateSuccess((e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  if (!e.record.getBool("active")) {
    helpers.releaseAssignments(e.app, "student = {:student} && endedAt = null", { student: e.record.id });
  }
  e.next();
}, "students");

// Award the same amount to one or many students at once.
routerAdd("POST", "/api/nfc/awards", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const amount = helpers.requirePositiveInt(body.amount, "Amount must be a positive whole number.");
  const reason = helpers.trimmedText(body.reason, "Classroom award");
  const key = helpers.trimmedText(body.idempotencyKey, "");
  if (!key) throw new BadRequestError("Missing request key.");

  const studentIds = [];
  for (const id of body.studentIds || []) {
    if (id && studentIds.indexOf(id) === -1) studentIds.push(id);
  }
  if (!studentIds.length) throw new BadRequestError("Choose at least one student.");

  let awarded = 0;
  const transactionIds = [];
  e.app.runInTransaction((tx) => {
    studentIds.forEach((studentId, index) => {
      const student = helpers.ownedStudent(tx, e.auth.id, studentId, true);
      const classroom = helpers.ownedClassroom(tx, e.auth.id, student.getString("classroom"), true);
      const idempotencyKey = `${key}-${index}`;
      // A retry of the same award returns the original rows rather than adding more.
      const previous = helpers.alreadyPosted(tx, e.auth.id, idempotencyKey);
      if (previous) {
        transactionIds.push(previous.id);
        return;
      }
      const posted = helpers.saveTransaction(tx, {
        student: student.id, classroom: classroom.id, amount, reason,
        kind: "AWARD", createdBy: e.auth.id, idempotencyKey,
      });
      transactionIds.push(posted.id);
      awarded++;
    });
  });
  return e.json(200, { awarded, transactionIds });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(16384));

// A single award or adjustment, which may be negative but never overdraws.
routerAdd("POST", "/api/nfc/entry", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    throw new BadRequestError("Amount must be a non-zero whole number.");
  }
  const kind = ["AWARD", "DEDUCT", "ADJUSTMENT", "CORRECTION"].indexOf(body.kind) === -1 ? "ADJUSTMENT" : body.kind;
  const reason = helpers.trimmedText(body.reason, "");
  if (!reason) throw new BadRequestError("A reason is required.");
  const key = helpers.trimmedText(body.idempotencyKey, "");
  if (!key) throw new BadRequestError("Missing request key.");

  const existing = helpers.alreadyPosted(e.app, e.auth.id, key);
  if (existing) return e.json(200, { id: existing.id, repeated: true });

  let created;
  e.app.runInTransaction((tx) => {
    const student = helpers.ownedStudent(tx, e.auth.id, body.studentId, true);
    const classroom = helpers.ownedClassroom(tx, e.auth.id, student.getString("classroom"), true);
    const current = helpers.balance(tx, student.id);
    if (current + amount < 0) {
      throw new BadRequestError(
        `Not enough ${classroom.getString("currencyName")}. Short by ${Math.abs(current + amount)}.`
      );
    }
    created = helpers.saveTransaction(tx, {
      student: student.id, classroom: classroom.id, amount, reason,
      kind, createdBy: e.auth.id, idempotencyKey: key,
    });
  });
  return e.json(200, { id: created.id, repeated: false });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(4096));

// Reverses an entry, putting any purchased stock back on the shelf.
routerAdd("POST", "/api/nfc/undo", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;

  e.app.runInTransaction((tx) => {
    let original;
    try {
      original = tx.findFirstRecordByFilter("transactions", "id = {:id} && createdBy = {:teacher}", {
        id: body.transactionId, teacher: e.auth.id,
      });
    } catch (_) {
      throw new BadRequestError("That action cannot be undone.");
    }
    const current = helpers.balance(tx, original.getString("student"));
    if (current - original.getInt("amount") < 0) {
      throw new BadRequestError("Undo would make the balance negative.");
    }
    const lines = tx.findRecordsByFilter("purchase_lines", "transaction = {:transaction}", "", 0, 0, {
      transaction: original.id,
    });
    for (const line of lines) {
      const itemId = line.getString("storeItem");
      if (!itemId) continue;
      const item = tx.findRecordById("store_items", itemId);
      if (!item.getBool("trackStock")) continue;
      item.set("stock", item.getInt("stock") + line.getInt("quantity"));
      tx.save(item);
    }
    tx.delete(original);
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(4096));

// One purchase transaction plus an immutable snapshot of what was bought.
routerAdd("POST", "/api/nfc/checkout", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const key = helpers.trimmedText(body.idempotencyKey, "");
  if (!key) throw new BadRequestError("Missing request key.");

  const existing = helpers.alreadyPosted(e.app, e.auth.id, key);
  if (existing) return e.json(200, { id: existing.id, repeated: true });

  const requested = [];
  for (const entry of body.items || []) {
    const quantity = Number(entry && entry.quantity);
    if (entry && entry.id && Number.isInteger(quantity) && quantity > 0) {
      requested.push({ id: entry.id, quantity });
    }
  }
  if (!requested.length) throw new BadRequestError("Choose at least one item.");

  let created;
  e.app.runInTransaction((tx) => {
    const student = helpers.ownedStudent(tx, e.auth.id, body.studentId, true);
    const classroom = helpers.ownedClassroom(tx, e.auth.id, student.getString("classroom"), true);

    const lines = requested.map((request) => {
      let item;
      try {
        item = tx.findFirstRecordByFilter("store_items", "id = {:id} && teacher = {:teacher} && active = true", {
          id: request.id, teacher: e.auth.id,
        });
      } catch (_) {
        throw new BadRequestError("One of those items is unavailable.");
      }
      if (item.getBool("trackStock") && item.getInt("stock") < request.quantity) {
        throw new BadRequestError(`${item.getString("name")} does not have enough stock.`);
      }
      return { item, quantity: request.quantity };
    });

    let total = 0;
    for (const line of lines) total += line.item.getInt("price") * line.quantity;
    const current = helpers.balance(tx, student.id);
    if (current < total) throw new BadRequestError(`Not enough balance. Short by ${total - current}.`);

    for (const line of lines) {
      if (!line.item.getBool("trackStock")) continue;
      line.item.set("stock", line.item.getInt("stock") - line.quantity);
      tx.save(line.item);
    }

    const summary = lines.map((line) => `${line.quantity} x ${line.item.getString("name")}`).join(", ");
    created = helpers.saveTransaction(tx, {
      student: student.id, classroom: classroom.id, amount: -total,
      reason: `Store purchase: ${summary}`, kind: "PURCHASE",
      createdBy: e.auth.id, idempotencyKey: key,
    });

    for (const line of lines) {
      const record = new Record(tx.findCollectionByNameOrId("purchase_lines"));
      record.set("transaction", created.id);
      record.set("storeItem", line.item.id);
      record.set("itemName", line.item.getString("name"));
      record.set("unitPrice", line.item.getInt("price"));
      record.set("quantity", line.quantity);
      tx.save(record);
    }
  });
  return e.json(200, { id: created.id, repeated: false });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(16384));

// Balances for a whole roster, so the browser never downloads the ledger.
routerAdd("GET", "/api/nfc/balances", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const classroomId = e.request.url.query().get("classroom");
  helpers.ownedClassroom(e.app, e.auth.id, classroomId, false);
  const students = e.app.findRecordsByFilter("students", "classroom = {:classroom} && teacher = {:teacher}", "", 0, 0, {
    classroom: classroomId, teacher: e.auth.id,
  });
  const balances = {};
  for (const student of students) balances[student.id] = helpers.balance(e.app, student.id);
  return e.json(200, { balances });
}, $apis.requireAuth("teachers"));
