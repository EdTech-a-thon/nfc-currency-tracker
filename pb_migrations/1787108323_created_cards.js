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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1597481275",
        "max": 64,
        "min": 20,
        "name": "token",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text3977037507",
        "max": 4,
        "min": 4,
        "name": "shortCode",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text245846248",
        "max": 20,
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
        "id": "select2063623452",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "AVAILABLE",
          "ASSIGNED",
          "LOST",
          "RETIRED"
        ]
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
    "id": "pbc_3481593366",
    "indexes": [
      "CREATE UNIQUE INDEX idx_cards_token ON cards (token)",
      "CREATE UNIQUE INDEX idx_cards_short_code ON cards (teacher, shortCode)",
      "CREATE UNIQUE INDEX idx_cards_label ON cards (teacher, label)",
      "CREATE INDEX idx_cards_status ON cards (teacher, status)"
    ],
    "listRule": "teacher = @request.auth.id",
    "name": "cards",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": "teacher = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3481593366");

  return app.delete(collection);
})
