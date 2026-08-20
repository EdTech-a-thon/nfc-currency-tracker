/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
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
        "collectionId": "pbc_3827815851",
        "help": "",
        "hidden": false,
        "id": "relation3072569139",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "student",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
        "help": "",
        "hidden": false,
        "id": "number2392944706",
        "max": null,
        "min": null,
        "name": "amount",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1001949196",
        "max": 200,
        "min": 1,
        "name": "reason",
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
        "id": "select1002749145",
        "maxSelect": 1,
        "name": "kind",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "AWARD",
          "DEDUCT",
          "PURCHASE",
          "ADJUSTMENT",
          "CORRECTION"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1842453536",
        "help": "",
        "hidden": false,
        "id": "relation4086712595",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "storeItem",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_3614170744",
        "help": "",
        "hidden": false,
        "id": "relation3545646658",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "createdBy",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text621540990",
        "max": 100,
        "min": 1,
        "name": "idempotencyKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
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
    "id": "pbc_3174063690",
    "indexes": [
      "CREATE UNIQUE INDEX idx_transactions_idempotency ON transactions (createdBy, idempotencyKey)",
      "CREATE INDEX idx_transactions_student ON transactions (student, created)",
      "CREATE INDEX idx_transactions_classroom ON transactions (classroom, created)"
    ],
    "listRule": "createdBy = @request.auth.id",
    "name": "transactions",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": "createdBy = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690");

  return app.delete(collection);
})
