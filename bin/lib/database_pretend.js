const debug = require('debug')('bin:lib:database_pretend');

let STORE_BY_UUID = {};

function writeToDatabase(item, table){
	debug(`writeToDatabase: item.uuid=${item.uuid}, item.distance=${item.distance}, table=${table}`);

	return new Promise( (resolve, reject) => {
		STORE_BY_UUID[item.uuid] = item;
		resolve();
	});
}

function readFromDatabase(item, table){
	debug(`readFromDatabase: reading item=${JSON.stringify(item)}, table=${table}`);
	return new Promise( (resolve, reject) => {
		const storedItem = STORE_BY_UUID[item.uuid];
		if (storedItem == undefined) {
			debug(`readFromDatabase: no item found`);
			resolve(undefined);
		} else {
			debug(`readFromDatabase: found storedItem: uuid=${storedItem.uuid}, distance=${storedItem.distance}`);
			resolve({Item : storedItem});
		}
	});
}

module.exports = {
	write    : writeToDatabase,
	read     : readFromDatabase,
};
