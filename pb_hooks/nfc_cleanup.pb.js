/// <reference path="../pb_data/types.d.ts" />

// Deleting a class or a whole school year. These remove students and their
// ledger rows together; the physical cards survive and return to the drawer.

routerAdd("POST", "/api/nfc/classrooms/delete", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;

  e.app.runInTransaction((tx) => {
    const classroom = helpers.ownedClassroom(tx, e.auth.id, body.classroomId, false);
    const students = tx.findRecordsByFilter("students", "classroom = {:classroom} && teacher = {:teacher}", "", 0, 0, {
      classroom: classroom.id, teacher: e.auth.id,
    });
    for (const student of students) {
      helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
      tx.delete(student);
    }
    tx.delete(classroom);
  });
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("POST", "/api/nfc/years/delete", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const schoolYear = helpers.trimmedText(body.schoolYear, "");
  if (!schoolYear) throw new BadRequestError("Choose a school year.");
  if (body.confirmation !== `DELETE ${schoolYear}`) {
    throw new BadRequestError(`Type DELETE ${schoolYear} to confirm.`);
  }

  let removed = 0;
  e.app.runInTransaction((tx) => {
    // Only archived classes are eligible, so a year still in use cannot vanish.
    const classes = tx.findRecordsByFilter(
      "classrooms", "teacher = {:teacher} && schoolYear = {:year} && archived = true", "", 0, 0,
      { teacher: e.auth.id, year: schoolYear }
    );
    for (const classroom of classes) {
      const students = tx.findRecordsByFilter("students", "classroom = {:classroom} && teacher = {:teacher}", "", 0, 0, {
        classroom: classroom.id, teacher: e.auth.id,
      });
      for (const student of students) {
        helpers.releaseAssignments(tx, "student = {:student} && endedAt = null", { student: student.id });
        tx.delete(student);
      }
      tx.delete(classroom);
      removed++;
    }
  });
  return e.json(200, { removed });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(4096));

// Archives or reopens every class in a school year at once.
routerAdd("POST", "/api/nfc/years/archive", (e) => {
  const helpers = require(`${__hooks}/nfc_shared.js`);
  const body = e.requestInfo().body;
  const schoolYear = helpers.trimmedText(body.schoolYear, "");
  if (!schoolYear) throw new BadRequestError("Choose a school year.");

  let changed = 0;
  e.app.runInTransaction((tx) => {
    const classes = tx.findRecordsByFilter("classrooms", "teacher = {:teacher} && schoolYear = {:year}", "", 0, 0, {
      teacher: e.auth.id, year: schoolYear,
    });
    for (const classroom of classes) {
      classroom.set("archived", true);
      classroom.set("archivedAt", new DateTime());
      tx.save(classroom);
      changed++;
    }
  });
  return e.json(200, { changed });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));
