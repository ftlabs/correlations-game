const debug = require('debug')('correlations-game:routes:index');
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');

router.get('/', (req, res) => {

	res.render('index', {
		userUUID : res.locals.userUUID
	});

});

router.post('/googlehome', (req, res) => {
	console.log(req.body.result.resolvedQuery);
	res.setHeader('Content-Type', 'application/json');
	const USER_INPUT = req.body.result.resolvedQuery;
	let answer = 'sorry' + USER_INPUT;

	// switch(USER_INPUT.toLowerCase()) {
	// 	case 'start':

	// 	break;

	// 	default:
	// 	answer = 'Sorry I didn\'t quite catch that...'
	// }
	router.handle({ url: '/question', method: 'GET' }, { end: done });

	res.send(JSON.stringify({'speech': answer, 'displayText': answer}));
});

// router.get('/question', (req, res) => {

// 	games.check(req.cookies['ftlabsCorrelationsGameUUID'])
// 		.then(gameIsInProgress => {
// 			debug(`gameIsInProgress ${gameIsInProgress}`)
// 			if(gameIsInProgress){
// 				return games.question(req.cookies['ftlabsCorrelationsGameUUID']);
// 			} else {
// 				return games.new(req.cookies['ftlabsCorrelationsUserUUID'])
// 					.then(gameUUID => {
// 						debug('slkfjhakjzsdf;kljsdfkldjflkjdfkj', gameUUID);
// 						const cookieOptions = { httpOnly : false, maxAge : 1000 * 60 * 60 * 24 * 10 }; // 10 day token
// 						res.cookie('ftlabsCorrelationsGameUUID', gameUUID, cookieOptions);
// 						return gameUUID;
// 					})
// 					.then(gameUUID => games.question(gameUUID))
// 				;
// 			}
// 		})
// 		.then(data => {

// 			if(data.limitReached === true){
// 				res.render('winner');
// 			} else {
// 				const preparedData = {};

// 				preparedData.seed = {
// 					value : data.seed,
// 					printValue : data.seed.replace('people:', '')
// 				};

// 				preparedData.options = {};

// 				Object.keys(data.options).forEach(key => {
// 					preparedData.options[key] = {
// 						value : data.options[key],
// 						printValue : data.options[key].replace('people:', '')
// 					};
// 				});

// 				debug(preparedData);

// 				res.render('question', preparedData);
// 			}

// 		})
// 		.catch(err => {
// 			debug(err);
// 			res.json({
// 				status : 'err',
// 				message : 'An error occurred as we tried to get the question.'
// 			});
// 		})

// });

router.get('/question', (req, res) => {
	console.log('routing is delightful');
	return 'hi there';
})

router.post('/answer', (req, res) => {

	debug(req.body.answer);

	const submittedAnswer = req.body.answer;

	if(!submittedAnswer){
		res.redirect('/question');
	} else {
		games.answer(req.cookies['ftlabsCorrelationsGameUUID'], req.body.answer)
			.then(result => {
				if(result.correct === true){
					res.redirect('/correct');
				} else {
					res.redirect('/incorrect');
				}
			})
	}

});

router.get('/correct', (req, res) => {
	res.render('correct', {theme : 'green'});
});

router.get('/incorrect', (req, res) => {
	res.render('incorrect', {theme : 'red'});
});

module.exports = router;
