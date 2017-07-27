const debug = require('debug')('bin:lib:barner-filter');

const CANDIDATES = process.env.BARNIER_LIST !== undefined ? process.env.BARNIER_LIST.split(',') : [];

function filterIndividualsFromGivenList(listOfPeople){
	debug('listOfPeople', listOfPeople);
	return listOfPeople.filter(person => {
		return !checkIfIndividualFallsFoulOfFilter(person.replace('people:', ''));
	});
}

function checkIfIndividualFallsFoulOfFilter (person) {
	debug(CANDIDATES.indexOf(person) > -1);
	return CANDIDATES.indexOf(person) > -1;
}

module.exports = {
	filter : filterIndividualsFromGivenList,
	check : checkIfIndividualFallsFoulOfFilter,
	list : function(){ return CANDIDATES; },
};
