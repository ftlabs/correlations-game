const debug = require('debug')('correlations-game:routes:index');
const express = require('express');
const router = express.Router();
const S3O = require('@financial-times/s3o-middleware');

const games = require('../bin/lib/game');
const correlations = require('../bin/lib/correlations');

router.get('/', S3O, (req, res) => {

	if (process.env.DATABASE === 'PRETEND') {
		res.clearCookie('ftlabsCorrelationsGameUUID');
	}

	res.render('index', {
		userUUID : res.locals.userUUID
	});

});

function processResultForDisplay( result ){
	result.articlesWording = (result.hasOwnProperty('linkingArticles') && result.linkingArticles.length === 1)? 'a recent article' : 'some recent articles';
	if(result.score === 0) {
		result.consecutiveWording = 'correct answers';
	} else if( result.score === 1) {
		result.consecutiveWording = 'correct answer';
	} else {
		result.consecutiveWording = 'consecutive correct answers';
	}
	result.displayable = {};
	[
		'expected', 'seedPerson', 'submittedAnswer'
	].forEach( field => {
		result.displayable[field] = (result[field] === undefined)? '' : result[field].replace('people:', '');
	} );
	result.displayable.history = [];
	if (result.hasOwnProperty('history')) {
		result.history.forEach( h => {
			result.displayable.history.push({
				seedPerson: h.seedPerson.replace('people:', ''),
				nextAnswer: h.nextAnswer.replace('people:', ''),
			});
		});
	}

	if (result.achievedHighestScore) {
		if (result.achievedHighestScoreFirst) {
			result.highestScoreMessage = `Congratulations: you are the first to achieve this high score.`;
		} else {
			result.highestScoreMessage = `Congratulations: you have equalled the current highest score.`;
		}
	} else if( result.globalHighestScore > 0 ){
		result.highestScoreMessage = `The overall highest score is ${result.globalHighestScore}.`;
	} else {
		result.highestScoreMessage = '';
	}

	return result;
}

router.post('^(/|/question)', S3O);

router.get('/question', S3O, (req, res) => {

	games.check(req.cookies['ftlabsCorrelationsGameUUID'])
		.then(gameIsInProgress => {
			debug(`/question: gameIsInProgress ${gameIsInProgress}`)
			if(gameIsInProgress){
				return games.question(req.cookies['ftlabsCorrelationsGameUUID']);
			} else {
				return games.new(req.cookies['ftlabsCorrelationsUserUUID'])
					.then(gameUUID => {
						debug(`/question: new gameUUID=${gameUUID}`);
						const cookieOptions = { httpOnly : false, maxAge : 1000 * 60 * 60 * 24 * 10 }; // 10 day token
						res.cookie('ftlabsCorrelationsGameUUID', gameUUID, cookieOptions);
						return gameUUID;
					})
					.then(gameUUID => games.question(gameUUID))
				;
			}
		})
		.then(result => {

			if(result.limitReached === true){
				processResultForDisplay(result);
				res.render('winner', result);
			} else {
				const preparedData = {};

				preparedData.intervalDays = result.intervalDays;

				preparedData.seed = {
					value : result.seed,
					printValue : result.seed.replace('people:', '')
				};

				preparedData.options = {};

				Object.keys(result.options).forEach(key => {
					preparedData.options[key] = {
						value : result.options[key],
						printValue : result.options[key].replace('people:', '')
					};
				});

				preparedData.questionNum = result.questionNum;

				debug(preparedData);

				res.render('question', preparedData);
			}

		})
		.catch(err => {
			debug(JSON.stringify(err));
			res.json({
				status : 'err',
				message : 'An error occurred as we tried to get the question.'
			});
		})
	;
});

router.post('/answer', S3O, (req, res) => {

	debug(req.body.answer);

	const submittedAnswer = req.body.answer;

	if(!submittedAnswer){
		res.redirect('/question');
	} else {
		games.answer(req.cookies['ftlabsCorrelationsGameUUID'], req.body.answer)
			.then(result => {
				processResultForDisplay( result );
				if(result.correct === true){
					res.render('correct', {result});
				} else {
					res.render('incorrect', {result});
				}
			})
			.catch( err => {
				debug(err);

				if(err === 'NO_VALID_ANSWER'){
					res.redirect('/question');
				} else {
					res.json({
						status : 'err',
						message : 'An error occurred as we tried to get the question.'
					});
				}

			})
		;
	}

});

router.get('/answer', S3O, (req, res) => {

	games.check(req.cookies['ftlabsCorrelationsGameUUID'])
		.then(gameExists => {
			if(gameExists){
				res.redirect('/question');
			} else {
				res.redirect('/');
			}
		})
		.catch(err => {
			debug('\t>>>> err:', err);
		})
	;

});

router.get('/stats', S3O, (req, res) => {
	games.stats()
	.then( stats => {
		res.json(stats);
	})
	.catch(err => {
		debug(JSON.stringify(err));
		res.json({
			status : 'err',
			message : 'An error occurred as we tried to get the stats.'
		});
	})
	;
});

router.post('/stats', S3O, (req, res) => {
	res.redirect('/stats');
});

router.get('/__gtg', (req,res) => {
	const status = healthCheck1().ok?200:503;
	res.status(status).end();
});

router.get('/__health', (req,res) => {
	console.log('HEALTH::', healthCheck1());
	const stdResponse = {
	    schemaVersion : 1,
	    systemCode    : `ftlabs-correlations-game`,
	    name          : `FT Labs Correlations Game`,
	    description   : `uses the Correlations:people service to create a Google Home game`,
	    checks        : [],
	};
	
	stdResponse.checks.push(healthCheck1());
	
	res.json(stdResponse);
});

function healthCheck1() {
	return correlations.allIslands()
	.then(data => {
		console.log('DATA::', data);
		return data;
	})
	.then(hasData => {
		console.log('healthOK');
		return {
			id               : 1,
			name             : 'checks the correlations:people service is running',
			ok               : hasData.length > 0,
			severity         : 1,
			businessImpact   : 'the FT Labs Google Home game, Make Connections, will be failing',
			technicalSummary : 'Fetches a response from the correlations services',
			panicGuide       : 'check the logs and ftlabs-correlations-people'
		};
	});
}

module.exports = router;
