/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && classroom.teacher = @request.auth.id",
    "deleteRule": "classroom.teacher = @request.auth.id",
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
        "collectionId": "pbc_1799974226",
        "help": "",
        "hidden": false,
        "id": "relation1232941213",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "classroom",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text245846248",
        "max": 100,
        "min": 1,
        "name": "label",
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
        "id": "number2392944706",
        "max": null,
        "min": 1,
        "name": "amount",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1063427325",
        "max": null,
        "min": null,
        "name": "sortOrder",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_3305186269",
    "indexes": [
      "CREATE INDEX idx_award_presets_order ON award_presets (classroom, sortOrder)"
    ],
    "listRule": "classroom.teacher = @request.auth.id",
    "name": "award_presets",
    "system": false,
    "type": "base",
    "updateRule": "classroom.teacher = @request.auth.id",
    "viewRule": "classroom.teacher = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3305186269");

  return app.delete(collection);
})
