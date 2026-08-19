/// <reference path="../pb_data/types.d.ts" />

// What a tapped card shows. The card's own token is the only credential, so
// this route is reachable without an account and deliberately hands back a
// read-only view unless the owning teacher is the one holding the phone.

routerAdd("GET", "/api/nfc/card/{identifier}", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const identifier = e.request.pathValue("identifier");
  const signedInTeacher = e.auth && e.auth.collection().name === "teachers" ? e.auth.id : "";

  let card;
  if (identifier.length === 4) {
    // Short codes are only unique per teacher, so they are for signed-in use.
    if (!signedInTeacher) throw new NotFoundError("Card not found.");
    try {
      card = e.app.findFirstRecordByFilter("cards", "shortCode = {:code} && teacher = {:teacher}", {
        code: identifier.toUpperCase(), teacher: signedInTeacher,
      });
    } catch (_) {
      throw new NotFoundError("Card not found.");
    }
  } else {
    try {
      card = e.app.findFirstRecordByFilter("cards", "token = {:token}", { token: identifier });
    } catch (_) {
      throw new NotFoundError("Card not found.");
    }
  }

  if (card.getString("status") !== "ASSIGNED") throw new NotFoundError("Card not assigned.");
  const open = e.app.findRecordsByFilter("card_assignments", "card = {:card} && endedAt = null", "", 1, 0, {
    card: card.id,
  });
  if (!open.length) throw new NotFoundError("Card not assigned.");

  const student = e.app.findRecordById("students", open[0].getString("student"));
  if (!student.getBool("active")) throw new NotFoundError("Card not assigned.");
  if (student.getString("teacher") !== card.getString("teacher")) throw new NotFoundError("Card not assigned.");
  const classroomId = student.getString("classroom");
  if (!classroomId) throw new NotFoundError("Card not assigned.");
  const classroom = e.app.findRecordById("classrooms", classroomId);
  const canManage = signedInTeacher !== "" && signedInTeacher === card.getString("teacher");

  const entries = e.app.findRecordsByFilter("transactions", "student = {:student}", "-created", 30, 0, {
    student: student.id,
  });
  const store = e.app.findRecordsByFilter(
    "store_items", "teacher = {:teacher} && active = true && (trackStock = false || stock > 0)",
    "sortOrder,name", 0, 0, { teacher: card.getString("teacher") }
  );

  const payload = {
    card: { id: card.id, label: card.getString("label"), shortCode: card.getString("shortCode") },
    student: { id: student.id, displayName: student.getString("displayName") },
    classroom: {
      id: classroom.id,
      name: classroom.getString("name"),
      currencyName: classroom.getString("currencyName"),
      currencySymbol: classroom.getString("currencySymbol"),
    },
    balance: helpers.balance(e.app, student.id),
    transactions: entries.map((entry) => ({
      id: entry.id,
      reason: entry.getString("reason"),
      amount: entry.getInt("amount"),
      created: entry.getString("created"),
    })),
    store: store.map((item) => ({ id: item.id, name: item.getString("name"), price: item.getInt("price") })),
    canManage,
    presets: [],
  };

  if (canManage) {
    const presets = e.app.findRecordsByFilter("award_presets", "classroom = {:classroom}", "sortOrder", 0, 0, {
      classroom: classroom.id,
    });
    payload.presets = presets.map((preset) => ({
      id: preset.id, label: preset.getString("label"), amount: preset.getInt("amount"),
    }));
  }

  return e.json(200, payload);
});
