const debug = require('debug')('bin:lib:database_pretend');

let STORE_BY_UUID = {};

function writeToDatabase(item, table){
	debug(`writeToDatabase: item.uuid=${item.uuid}, item.distance=${item.distance}, table=${table}`);

	return Promise.resolve()
	.then( () => {
		return JSON.parse(JSON.stringify(item)); // convert into basic obj, minus all the class stuff
	})
	.then( itemObj => {
		STORE_BY_UUID[itemObj.uuid] = itemObj;
	})
	.catch( err => {
		debug(`ERROR: writeToDatabase: err=${err}`);
		throw err;
	})
	;
}

function readFromDatabase(item, table){
	debug(`readFromDatabase: reading item=${JSON.stringify(item)}, table=${table}`);
	return Promise.resolve()
	.then( () => {
		const storedItem = STORE_BY_UUID[item.uuid];
		if (storedItem === undefined) {
			debug(`readFromDatabase: no item found`);
			return {};
		} else {
			debug(`readFromDatabase: found storedItem: uuid=${storedItem.uuid}, distance=${storedItem.distance}`);
			return {Item : storedItem};
		}
	});
}

module.exports = {
	write    : writeToDatabase,
	read     : readFromDatabase,
};
