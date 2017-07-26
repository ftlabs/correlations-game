const debug = require('debug')('active-sessions-interface');

const database = require('./database');

function checkSessionExistsInDatabase(sessionID){

	return database.read({id : sessionID}, process.env.SESSION_TABLE)
		.then(data => {
			debug('Item retrieved from database (check)', data);
			if(data.Item === undefined){
				return false;
			} else {
				return true;
			}
		})
		.catch(err => {
			debug(`An error occurred checking if session ${sessionID} existed`, err);
			throw err;
		})
	;

}

function getActiveSessionFromDatabase(sessionID){
	
	return database.read({id : sessionID}, process.env.SESSION_TABLE)
		.then(data => {
			debug('Item retrieved from database (get)', data);
			return data.Item;
		})
		.catch(err => {
			debug(`An error occurred checking if session ${sessionID} existed`, err);
			throw err;
		})
	;

}

function saveActiveSessionToDatabase(session){

	return database.write(session, process.env.SESSION_TABLE)
		.then(result => {
			debug('Item saved to database (check)', result);
			return result;
		})
		.catch(err => {
			debug(`An error occurred writing session to database`, err, session);
			throw err;
		})
	;

}

module.exports = {
	check : checkSessionExistsInDatabase,
	get : getActiveSessionFromDatabase,
	set : saveActiveSessionToDatabase
};