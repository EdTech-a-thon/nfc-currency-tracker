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
        "collectionId": "pbc_3174063690",
        "help": "",
        "hidden": false,
        "id": "relation1916208593",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "transaction",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1416606704",
        "max": 100,
        "min": 1,
        "name": "itemName",
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
        "id": "number3672808604",
        "max": null,
        "min": null,
        "name": "unitPrice",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2683508278",
        "max": null,
        "min": 1,
        "name": "quantity",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_3156310571",
    "indexes": [],
    "listRule": "transaction.createdBy = @request.auth.id",
    "name": "purchase_lines",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": "transaction.createdBy = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3156310571");

  return app.delete(collection);
})
