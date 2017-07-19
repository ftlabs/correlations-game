const debug = require('debug')('bin:lib:barner-filter');

const CANDIDATES = process.env.BARNIER_LIST || [];

module.exports = (person) => {
	debug(CANDIDATES.indexOf(person) > -1);
	return CANDIDATES.indexOf(person) > -1;
}