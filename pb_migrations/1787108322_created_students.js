/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && teacher = @request.auth.id",
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_3614170744",
        "help": "",
        "hidden": false,
        "id": "relation2968954581",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "teacher",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1799974226",
        "help": "",
        "hidden": false,
        "id": "relation1232941213",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "classroom",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1731158936",
        "max": 100,
        "min": 1,
        "name": "displayName",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool1260321794",
        "name": "active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_3827815851",
    "indexes": [
      "CREATE INDEX idx_students_roster ON students (teacher, classroom, active)"
    ],
    "listRule": "teacher = @request.auth.id",
    "name": "students",
    "system": false,
    "type": "base",
    "updateRule": "teacher = @request.auth.id",
    "viewRule": "teacher = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3827815851");

  return app.delete(collection);
})
