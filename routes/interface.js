const debug = require('debug')('correlations-game:routes:interface');
const express = require('express');
const router = express.Router();

const uuid = require('uuid').v4;

const games = require('../bin/lib/game');

/* GET home page. */
router.get('/', function(req, res) {
  res.end();
});

router.get('/start', (req, res) => {

	const userUUID = req.cookies['ftlabsCorrelationsUserUUID'] || req.query.userUUID || uuid();

	games.new(userUUID)
		.then(gameID => {
			res.json({
				status : 'ok',
				data : {
					gameID
				}
			});
		})
		.catch(err => {
			debug(err);
			res.status = err.status || 500;
			res.json({
				status : 'err',
				message : err.message || 'An error ocurred fulfilling that request'
			});
		})
	;

});

router.get('/question/:gameUUID', (req, res) => {

	const gameUUID = req.params.gameUUID;

	games.question(gameUUID)
		.then(question => {
			res.json({
				status : "ok",
				data : question
			});
		})
		.catch(err => {
			debug(err);
			res.status = err.status || 500;
			res.json({
				status : 'err',
				message : err === 'GAMEOVER' ? 'This game has already been played to completion' : err.message || 'An error ocurred fulfilling that request'
			});
		})
	;

});

router.get('/answer/:gameUUID/:submittedAnswer', (req, res) => {

	const gameUUID = req.params.gameUUID;
	const submittedAnswer = req.params.submittedAnswer;

	games.answer(gameUUID, submittedAnswer)
		.then(correct => {
			res.json({
				status : 'ok',
				correct
			});
		})
		.catch(err => {
			debug(err);
			res.status = err.status || 500;
			res.json({
				status : 'err',
				message : err.message || 'An error ocurred fulfilling that request'
			});
		})
	;

});

router.get('/highscores', (req, res) => {

	games.highScores()
		.then(scores => {
			res.json({
				scores
			});
		})
		.catch(err => {
			debug(err);
			res.status = err.status || 500;
			res.json({
				status : 'err',
				message : 'Could not retrieve high scores'
			});
		})
	;

});

module.exports = router;
