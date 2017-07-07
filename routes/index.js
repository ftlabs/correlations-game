const debug = require('debug')();
const express = require('express');
const router = express.Router();

const games = require('../bin/lib/game');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/start', (req, res, next) => {

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
				message : err.message || "An error ocurred fulfilling that request"
			});
		})
	;

});

module.exports = router;
