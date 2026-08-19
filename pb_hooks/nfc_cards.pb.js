/// <reference path="../pb_data/types.d.ts" />

// Card, roster and clean-up routes. Each one touches several records at once,
// so they run here as a unit instead of as a sequence of calls from a browser
// that might close halfway through.

// Mints a batch of blank cards with unique short codes and running labels.
routerAdd("POST", "/api/nfc/cards/generate", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const count = helpers.requirePositiveInt(e.requestInfo().body.count, "Create between 1 and 200 cards.");
  if (count > 200) throw new BadRequestError("Create between 1 and 200 cards.");

  const created = [];
  e.app.runInTransaction((tx) => {
    const existing = tx.findRecordsByFilter("cards", "teacher = {:teacher}", "", 0, 0, { teacher: e.auth.id });
    const taken = {};
    let nextLabel = 0;
    for (const card of existing) {
      taken[card.getString("shortCode")] = true;
      const label = Number(card.getString("label"));
      if (Number.isInteger(label) && label > nextLabel) nextLabel = label;
    }

    for (let index = 0; index < count; index++) {
      let shortCode = $security.randomStringWithAlphabet(4, helpers.CARD_ALPHABET);
      while (taken[shortCode]) shortCode = $security.randomStringWithAlphabet(4, helpers.CARD_ALPHABET);
      taken[shortCode] = true;

      const card = new Record(tx.findCollectionByNameOrId("cards"));
      card.set("teacher", e.auth.id);
      card.set("token", $security.randomString(32));
      card.set("shortCode", shortCode);
      card.set("label", String(++nextLabel));
      card.set("status", "AVAILABLE");
      tx.save(card);
      created.push(card.id);
    }
  });
  return e.json(200, { created: created.length });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// Hands one card to one student, retiring whatever either of them held before.
routerAdd("POST", "/api/nfc/cards/assign", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;

  e.app.runInTransaction((tx) => {
    const student = helpers.ownedStudent(tx, e.auth.id, body.studentId, true);
    let card;
    try {
      card = tx.findFirstRecordByFilter("cards", "id = {:id} && teacher = {:teacher} && status = 'AVAILABLE'", {
        id: body.cardId, teacher: e.auth.id,
      });
    } catch (_) {
      throw new BadRequestError("That student or card is unavailable.");
    }

    helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
    helpers.releaseAssignments(tx, "card = {:card} && endedAt = null", { card: card.id });

    const assignment = new Record(tx.findCollectionByNameOrId("card_assignments"));
    assignment.set("card", card.id);
    assignment.set("student", student.id);
    tx.save(assignment);

    card.set("status", "ASSIGNED");
    tx.save(card);
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("POST", "/api/nfc/cards/unassign", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  e.app.runInTransaction((tx) => {
    const student = helpers.ownedStudent(tx, e.auth.id, body.studentId, false);
    helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// Pairs every unassigned student in a class with a spare card, in name order.
routerAdd("POST", "/api/nfc/cards/auto-assign", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;

  let paired = 0;
  e.app.runInTransaction((tx) => {
    const classroom = helpers.ownedClassroom(tx, e.auth.id, body.classroomId, false);
    const students = tx.findRecordsByFilter(
      "students", "classroom = {:classroom} && teacher = {:teacher} && active = true",
      "displayName", 0, 0, { classroom: classroom.id, teacher: e.auth.id }
    );
    const waiting = students.filter((student) => {
      const open = tx.findRecordsByFilter("card_assignments", "student = {:student} && endedAt = null", "", 1, 0, {
        student: student.id,
      });
      return open.length === 0;
    });

    const spare = tx.findRecordsByFilter("cards", "teacher = {:teacher} && status = 'AVAILABLE'", "", 0, 0, {
      teacher: e.auth.id,
    });
    spare.sort((left, right) => Number(left.getString("label")) - Number(right.getString("label")));

    for (let index = 0; index < waiting.length && index < spare.length; index++) {
      const assignment = new Record(tx.findCollectionByNameOrId("card_assignments"));
      assignment.set("card", spare[index].id);
      assignment.set("student", waiting[index].id);
      tx.save(assignment);
      spare[index].set("status", "ASSIGNED");
      tx.save(spare[index]);
      paired++;
    }
  });
  return e.json(200, { paired });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// Collects every card back in from one class.
routerAdd("POST", "/api/nfc/cards/reset", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;

  let released = 0;
  e.app.runInTransaction((tx) => {
    const classroom = helpers.ownedClassroom(tx, e.auth.id, body.classroomId, false);
    const students = tx.findRecordsByFilter("students", "classroom = {:classroom} && teacher = {:teacher}", "", 0, 0, {
      classroom: classroom.id, teacher: e.auth.id,
    });
    for (const student of students) {
      released += helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
    }
  });
  return e.json(200, { released });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// Marks cards lost, retired or back in the drawer, ending any active loan.
routerAdd("POST", "/api/nfc/cards/status", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const status = body.status;
  if (["AVAILABLE", "LOST", "RETIRED"].indexOf(status) === -1) throw new BadRequestError("Invalid card status.");

  const cardIds = [];
  for (const id of body.cardIds || []) if (id && cardIds.indexOf(id) === -1) cardIds.push(id);
  if (!cardIds.length) throw new BadRequestError("Select at least one card.");
  if (cardIds.length > 200) throw new BadRequestError("Select at most 200 cards.");

  e.app.runInTransaction((tx) => {
    for (const cardId of cardIds) {
      let card;
      try {
        card = tx.findFirstRecordByFilter("cards", "id = {:id} && teacher = {:teacher}", {
          id: cardId, teacher: e.auth.id,
        });
      } catch (_) {
        throw new BadRequestError("One or more cards were not found.");
      }
      helpers.releaseAssignments(tx, "card = {:card} && endedAt = null", { card: card.id });
      card.set("status", status);
      tx.save(card);
    }
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(16384));

// Takes students off a roster without erasing their history.
routerAdd("POST", "/api/nfc/students/remove", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const studentIds = [];
  for (const id of body.studentIds || []) if (id && studentIds.indexOf(id) === -1) studentIds.push(id);
  if (!studentIds.length) throw new BadRequestError("Select at least one student.");
  if (studentIds.length > 200) throw new BadRequestError("Select at most 200 students.");

  e.app.runInTransaction((tx) => {
    const classroom = helpers.ownedClassroom(tx, e.auth.id, body.classroomId, false);
    for (const studentId of studentIds) {
      const student = helpers.ownedStudent(tx, e.auth.id, studentId, false);
      if (student.getString("classroom") !== classroom.id) continue;
      helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
      student.set("classroom", "");
      student.set("active", false);
      tx.save(student);
    }
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(16384));
