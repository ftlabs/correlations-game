const debug = require('debug')();
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/start', (req, res) => {

	games.new("1234")
		.then(gameID => {
			res.json({
				status : 'OK',
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
				message : err.message || 'An error ocurred fulfilling that request'
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

module.exports = router;
