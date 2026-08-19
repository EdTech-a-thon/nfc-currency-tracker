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
        "collectionId": "pbc_3481593366",
        "help": "",
        "hidden": false,
        "id": "relation370448595",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "card",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
        "hidden": false,
        "id": "autodate3870244367",
        "name": "assignedAt",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "help": "",
        "hidden": false,
        "id": "date3884100663",
        "max": "",
        "min": "",
        "name": "endedAt",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_3375477186",
    "indexes": [
      "CREATE INDEX idx_assignments_card ON card_assignments (card, endedAt)",
      "CREATE INDEX idx_assignments_student ON card_assignments (student, endedAt)"
    ],
    "listRule": "card.teacher = @request.auth.id",
    "name": "card_assignments",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": "card.teacher = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3375477186");

  return app.delete(collection);
})
