(function() {

// Point:
function Point(x, y) {
	this.x = x;
	this.y = y;
}

Point.prototype = {
	distance: function(x, y) {
		var a = x - this.x;
		var b = y - this.y;
		return Math.sqrt(a*a + b*b);
	}
};

// Rectangle:
function Rect(x, y, w, h) {
	this.x = x;
	this.y = y;
	this.width = w;
	this.height = h;
}

Rect.prototype = {
	hitTestPoint: function(x, y) {
		return x > this.x && x < this.x + this.width && y > this.y && y < this.y + this.height;
	}
};

Geom = {
	point: function(x, y) {
		return new Point(x, y);
	},

	rect: function(x, y, w, h) {
		return new Rect(x, y, w, h);
	},

	rgb: function(r, g, b) {
		return {
			r: r,
			g: g,
			b: b
		};
	}
};


function extend(obj1, obj2) {
	var union = (typeof obj1 === 'function') ? obj1 : {};
	var i;

	for (i in obj1) {
		if (obj1.hasOwnProperty(i)) union[i] = obj1[i];
	}
	for (i in obj2) {
		if (obj2.hasOwnProperty(i)) union[i] = obj2[i];
	}

	return union;
}

var Spritesheet = {
	frames: {
		'fish_basic': Geom.rect(18, 0, 94, 38),
		'fish_prize': Geom.rect(0, 40, 112, 52),
		'fish_zap': Geom.rect(112, 0, 115, 103),
		'hook_empty': Geom.rect(465, 0, 15, 26),
		'hook_catch': Geom.rect(465, 26, 15, 26),
		'clock': Geom.rect(408, 0, 56, 56),
		'catch1': Geom.rect(0, 215, 110, 170),
		'catch2': Geom.rect(110, 215, 110, 170),
		'catch3': Geom.rect(220, 215, 110, 170),
		'catch4': Geom.rect(330, 215, 110, 170),
		'jellyfish1': Geom.rect(0, 0, 80, 105),
		'jellyfish2': Geom.rect(80, 0, 80, 105),
		'jellyfish3': Geom.rect(160, 0, 80, 105),
		'jellyfish4': Geom.rect(240, 0, 80, 105),
		'jellyfish5': Geom.rect(320, 0, 80, 105),
		'jellyfish6': Geom.rect(400, 0, 80, 105)
	},

	load: function() {
		this.image = new Image();
		this.image.onload = function() {};
		this.image.src = "media/sprites.png";
	},

	drawSprite: function(ctx, id, x, y) {
		var f = this.frames[id];
		ctx.drawImage(this.image, f.x, f.y, f.width, f.height, x, y, f.width, f.height);
	}
};

var Game = this.Fishing = function() {
	this.el = document.createElement('canvas');
	this.el.setAttribute('width', 1024);
	this.el.setAttribute('height', 768);
	this.bounds = Geom.rect(0, 260, 1024, 440);
	this.hookables = [];
};

Game.prototype = {
	mouseX:0,
	mouseY:0,
	alpha: 1,
	points: 0,
	multiplier: 1,
	seconds: 0,
	secondsMax: 30,
	hookables: [], // Array of hookable Fish & Jellyfish objects.
	target: Geom.rect(545, 175, 105, 40), // Rect of the drag-to target (net).
	frameRateId: null, // setInterval ID of the framerate interval.
	timerId: null, // setTimeout ID of the timer timeout.
	delayBlockers: 0, // post-block time delay when blockers may not be caught.
	scoredThisSecond: false, // tracks if a fish was caught during the last second.
	messageField: document.createElement('div'),
	playing: false,
	running: false,
	frameHandler: null,
	
	load: function() {
		var self = this;
		this.sprites = new Image();
		this.sprites.onload = function() {
			var i;

			// Create all fish & jellyfish objects:
			for (i = 0; i < Fish.count; i++) {
				self.hookables.push(new Fish(self, i));
			}

			for (i = 0; i < Jellyfish.count; i++) {
				self.hookables.push(new Jellyfish(self, i));
			}

			self.net = new NetView(self);
			self.hook = new HookView(self);
			self.clock = new ClockView(self);
			self.bonus = new BonusView(self);
			self.score = new ScoreView(self);
			self.sound = new Sound();
			self.start();
		};
		this.sprites.src = "media/sprites.png";
	},

	/**
	* Resets the game setup and starts the framerate.
	*/
	start: function(){
		var self = this;
		Fish.allowedPrizes = 2;
	
		// Reset all fish.
		for (var i = 0; i < this.hookables.length; i++) {
			this.hookables[i].reset();
		}
		
		// Reset game variables.
		this.alpha = 1;
		this.points = 0;
		this.multiplier = 1;
		this.seconds = this.secondsMax + 1;
		// this.score.text( this.points );
		// this.messageField.text('').hide();
		this.sound.startMusic();
		this.bonus.reset(1);

		this.playing = true;
		this.running = true;
		this.update();

		this.onMouseMove = function(evt) {
			self.mouseX = evt.layerX;
			self.mouseY = evt.layerY;
		};

		this.el.addEventListener('mousemove', this.onMouseMove);
		this.requestAnimFrame();
		this.requestTimerTick();
	},

	/**
	* Disables the framerate to kill all game playback.
	*/
	stop: function() {
		this.update();
		clearTimeout(this.frameRateId);
		clearTimeout(this.timerId);
		this.el.removeEventListener('mousemove', this.onMouseMove);
		this.onMouseMove = null;
		this.running = false;
	},

	/**
	* Schedules an animation frame.
	* Designed to interface at some point with the native browser animation API.
	* Currently configured as a chained timeout set to run at 30fps.
	*/
	requestAnimFrame: function() {
		var self = this;

		self.frameRateId = setTimeout(function() {
			// Update, then request next animation frame while program is running:
			self.update();
			if (self.running) self.requestAnimFrame();
		}, 1000/30);
	},

	requestTimerTick: function() {
		var self = this;

		self.timerId = setTimeout(function() {
			self.seconds--;
	
			// decrement number of allowed prizes if bonus has accrued.
			if (!self.scoredThisSecond && Fish.allowedPrizes > 2) {
				Fish.allowedPrizes--;
			}
			
			if (!self.scoredThisSecond) {
				self.multiplier = 1;
			}
			
			self.scoredThisSecond = false;
		
			if (self.running && self.seconds > 0) {
				self.requestTimerTick();
			} else {
				self.stop();
			}
		}, 1000);
	},

	/**
	* Called upon each frame refresh.
	*/
	update: function() {
		var ctx = this.el.getContext('2d');
		var cw = ctx.canvas.width;
		var ch = ctx.canvas.height;

		// Decrememt game alpha when no longer playing.
		// Stop game once display has completely faded out.
		if (!this.playing) {
			this.alpha = Math.round((this.alpha - 0.05) * 100) / 100; //<< avoid repeating decimals.
			if (this.alpha <= 0) this.stop();
		}
	
		// decrement post-blocker grace period.
		if (this.delayBlockers > 0) {
			this.delayBlockers--;
		}
		
		ctx.moveTo(0, 0);
		ctx.clearRect(0, 0, cw, ch);
		ctx.globalAlpha = this.alpha;
		ctx.strokeStyle = 'rgba(100,100,100,0.5)';
		ctx.lineWidth = 1;

		// Update hook position.
		this.hook.update(this.mouseX, this.mouseY);
	
		// Update all fish objects.
		var blocker;
			
		for (var i = 0; i < this.hookables.length; i++) {
			var fish = this.hookables[i];

			// test for catches.
			if (this.playing && !this.hook.payload && this.hook.trendY < 0) {
				if (fish.testHook(this.hook.x, this.hook.y)) {
					if (!fish.blocker || !this.delayBlockers) {
						this.hook.hookObject(fish);
					}
				}
			}
		
			// find eligible blocker for current hook position.
			if (!blocker && fish.blocker && fish.testHit(this.hook.x, this.hook.y)) {
				blocker = fish;
			}
			
			fish.update();
			fish.draw(ctx);
		}
	
		// If a blocker was found and the hook has a non-blocker payload, kill the payload.
		if (!!blocker && !!this.hook.payload && !this.hook.payload.blocker) {
			this.hook.payload.dead = true;
			this.hook.unhookObject();
			this.sound.block();
			this.delayBlockers = 10;
		}
					
		// Test for points
		if (!!this.hook.payload && this.target.hitTestPoint(this.hook.x, this.hook.y)) {
			var points = this.hook.catchObject() * this.multiplier;
			this.points += points;
			this.score.points = this.points;
			this.net.play();
			
			if (points > 0) {
				this.sound.goodCatch();
			} else {
				this.sound.badCatch();
			}
			
			// configures the multiplier graphic.
			this.bonus.reset(this.multiplier, points < 0);
		
			if (points > 0) {
				this.scoredThisSecond = true;
				this.multiplier++;
				Fish.allowedPrizes++;
			} else {
				this.multiplier = 1;
			}
		}

		// Draw fishing line:
		ctx.save();
		ctx.beginPath();
		ctx.moveTo(340, 25);
		ctx.quadraticCurveTo(340, 300, this.hook.x, this.hook.y);
		ctx.stroke();
		ctx.closePath();
		ctx.restore();
	
		// Draw all views:
		this.bonus.draw(ctx);
		this.hook.draw(ctx);
		this.clock.draw(ctx, this.seconds / this.secondsMax);
		this.net.draw(ctx);
	}
};

/**
* Controller object for interfacing with the game's sound player.
*/
function Sound() {}

Sound.prototype = {
	startMusic: function() {

	},

	stopMusic: function() {

	},

	goodCatch: function() {

	},

	badCatch: function() {

	},

	block: function() {

	},

	timeout: function() {

	}
};


function ScoreView(game) {
	this.parent = game;
}

ScoreView.prototype = {
	draw: function(ctx) {

	}
};


function BonusView(game) {
	this.parent = game;
}

BonusView.prototype = {
	reset: function() {

	},

	draw: function() {

	}
};


function NetView(game) {
	this.parent = game;
}

NetView.prototype = {
	x: 546,
	y: 66,
	frame: Geom.rect(0, 215, 110, 170),
	playing: false,
	currentFrame: 0,
	maxFrames: 3,
	direction: 1,
	framerate: 0,

	play: function() {
		this.playing = true;
		this.framerate = 0;
	},

	stop: function() {
		this.playing = false;
		this.direction = 1;
		this.currentFrame = 0;
		this.currentCycle = 0;
	},

	draw: function(ctx) {
		if (this.playing && this.framerate++ % 3 === 0) {
			this.currentFrame += this.direction;

			if (this.currentFrame >= this.maxFrames) {
				this.direction = -1;
			} else if (this.currentFrame <= 0) {
				this.stop();
			}
		}

		var f = this.frame;
		ctx.save();
		ctx.drawImage(this.parent.sprites, f.x + f.width * this.currentFrame, f.y, f.width, f.height, this.x, this.y, f.width, f.height);
		ctx.restore();
	}
};


function ClockView(parent) {
	this.parent = parent;
	this.image = document.createElement('canvas');
	this.image.setAttribute('width', this.frame.width);
	this.image.setAttribute('height', this.frame.height);
	this.fill = Geom.rgb(0, 0, 0);
	this.value = -1;
}

ClockView.prototype = {
	x: 974,
	y: 50,
	frame: Geom.rect(408, 0, 56, 56),

	palette: [
		Geom.rgb(240,200,117),
		Geom.rgb(203,153,78),
		Geom.rgb(254,3,2)
	],

	render: function(percent) {
		percent = percent || 0;

		var radius = 23;
		var radians = percent * 2;
		var f = this.frame;
		var ca = percent > 0.5 ? this.palette[0] : this.palette[1];
		var cb = percent > 0.5 ? this.palette[1] : this.palette[2];
		var p = 1-(percent > 0.5 ? percent - 0.5 : percent) / 0.5;
		var ctx = this.image.getContext('2d');

		ctx.save();
		ctx.clearRect(0, 0, f.width, f.height);
		ctx.translate(Math.round(f.width / 2), Math.round(f.height / 2) - 2);
		
		// calculate fill color.
		this.fill.r = Math.round(ca.r + (cb.r - ca.r) * p);
		this.fill.g = Math.round(ca.g + (cb.g - ca.g) * p);
		this.fill.b = Math.round(ca.b + (cb.b - ca.b) * p);

		// draw gray circle in the background.
		ctx.fillStyle = '#999999';
		ctx.beginPath();
		ctx.arc(0, 0, radius, 0, Math.PI*2);
		ctx.closePath();
		ctx.fill();

		// draw colored pie wedge.
		ctx.fillStyle = 'rgba('+this.fill.r+','+this.fill.g+','+this.fill.b+',1)';
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, radius, -Math.PI/2, (Math.PI * 2 * percent) - Math.PI / 2);
		ctx.lineTo(0, 0);
		ctx.closePath();
		ctx.fill();

		// Draw clock face.
		ctx.drawImage(this.parent.sprites, f.x, f.y, f.width, f.height, -f.width/2, -f.height/2+2, f.width, f.height);

		// Draw clock hand.
		ctx.fillStyle = "#000000";
		ctx.rotate(Math.PI * 2 * percent);
		ctx.beginPath();
		ctx.moveTo(-2, 3);
		ctx.lineTo(-0.5, 3-radius);
		ctx.lineTo(0.5, 3-radius);
		ctx.lineTo(2, 3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		
		// Store value.
		this.value = Math.floor(percent * 100);
	},

	draw: function(ctx, percent) {
		if (Math.floor(percent * 100) !== this.value) {
			// re-render the clock image each time the value changes.
			// this should only happen once per second rather than every frame.
			this.render(percent);
		}

		// draw the clock image into the game display.
		ctx.drawImage(this.image, this.x - Math.round(this.image.width / 2), this.y - Math.round(this.image.height / 2));
	}
};


function HookView(parent) {
	this.parent = parent;
	this.moves = [];

	// pre-populate location history with a collection of points.
	for (var i = 0; i < 5; i++) {
		this.moves.push(Geom.point(this.x, this.y));
	}
}

HookView.prototype = {
	x: 550,
	y: 330,
	rotation: 0,
	payload: null, // HookableObject
	frame: Geom.rect(465, 0, 15, 26),
	trendX: 0,
	trendY: 0,

	hookObject: function(hookableObject) {
		this.payload = hookableObject;
		this.payload.hooked = true;
	},

	unhookObject: function() {
		if (!!this.payload) {
			this.payload.hooked = false;
			this.payload = null;
		}
	},	

	catchObject: function() {
		var score = this.payload.getScore();
		this.payload.reset();
		this.unhookObject();
		return score;
	},

	update: function(mx, my) {
		// Cycle mouse history to always include the most recent mouse positions.
		var prev = this.moves[0];
		var next = this.moves.pop();
		var move = prev.distance(next.x, next.y);
		
		next.x = mx;
		next.y = Math.max(my, this.parent.bounds.y - 60);

		// Calculate average position of all recorded mouse positions.
		this.moves.unshift(next);
		this.trendX = 0;
		this.trendY = 0;

		var total = this.moves.length;
		var avX = 0;
		var avY = 0;
		var last;

		for (i=0; i < total; i++) {
			var pt = this.moves[i];
			avX += pt.x;
			avY += pt.y;

			if (!!last) {
				this.trendX += (last.x - pt.x);
				this.trendY += (last.y - pt.y);
			}

			last = pt;
		}
	
		// Set hook position to average mouse position.
		this.x = avX / total;
		this.y = avY / total;

		if (move > 2) {
			this.rotation = Math.atan2(this.trendY, this.trendX) + Math.PI/2;
		} else {
			this.rotation -= (this.rotation/15);
		}
	
		// Update payload object.
		if (!!this.payload) {
			if (move > 5 && this.trendY <= 0) {
				// must move upward 5+ pixels per frame to retain the payload.
				this.payload.x = this.x;
				this.payload.y = this.y;
				this.payload.rotate(this.rotation);
			} else {
				this.unhookObject();
			}
		}
	},

	draw: function(ctx) {
		var f = this.frame;
		var offset = (!!this.payload ? f.height : 0);
			
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		ctx.drawImage(this.parent.sprites, f.x, f.y + offset, f.width, f.height, -3, -3, f.width, f.height);
		ctx.restore();
	}
};

// Hookable Object Prototype:

var Hookable = {
	index: 0,
	depth: 0,
	x: 0,
	y: 0,
	scale: 1,
	alpha: 1,
	width: 0,
	height: 0,
	blocker: false,
	hooked: false,
	dead: false,
	speedX: 0,
	speedY: 0,
	frame: Geom.rect(0, 0, 1, 1),
	testHookDist: 20,
	testHitDist: 20,
	imageX: 0,
	imageY: 0,
	rotation: 0,
	
	rotate: function(radians) {
		this.rotation = radians;
	},

	unwind: function() {
		// Reduces rotation in small increments until it reaches zero.
		// This method is intended to be called externally with the framerate.
		if (this.rotation === 0) {
			return;
		}

		var inc = 0.17;
		var pi2 = Math.PI * 2;

		// correct extreme rotations by turning them back to within range of a single circle.
		if (this.rotation < 0) {
			while (this.rotation < 0) this.rotation += pi2;
		} else if (this.rotation > pi2) {
			while (this.rotation > pi2) this.rotation -= pi2;
		}

		// increment rotation in the nearest direction back to zero.
		if (this.rotation < Math.PI && this.rotation - inc > 0) {
			this.rotation -= inc;
		} else if (this.rotation > Math.PI && this.rotation + inc < pi2) {
			this.rotation += inc;
		} else {
			this.rotation = 0;
		}
	},
	
	getScore: function() {
		return 1;
	},
	
	testHook: function(x, y) {
		return Point.prototype.distance.call(this, x, y) < this.testHookDist;
	},
	
	testHit: function(x, y) {
		return Point.prototype.distance.call(this, x, y) < this.testHitDist;
	},
	
	reset: function() {
		this.width = Math.ceil(this.frame.width * this.scale);
		this.height = Math.ceil(this.frame.height * this.scale);
		this.rotation = 0;
		this.alpha = 1;
	},
	
	update: function() {
		this.unwind();
	},

	draw: function(ctx) {
		// do stuff.
	}
};

/**
* Controller object for managing hookable Fish targets.
*/
function Fish(parent, index) {
	this.parent = parent;
	this.index = index;
	this.depth = index / Fish.count;
	this.initImage();
}

extend(Fish, {
	count: 15,
	numPrize: 0,
	allowedPrizes: 2
});

Fish.prototype = extend(Hookable, {
	image: null,
	direction: 1,
	baseSpeed: 0,
	burstSpeed: 0,
	prize: false,
	animateTurn: null, // function for reversing the fish direction.
	rectBasic: Geom.rect(18, 0, 94, 38),
	rectPrize: Geom.rect(0, 40, 112, 52),
	rectZap: Geom.rect(112, 0, 115, 103),

	/**
	* Renders an image of the fish with a color transformation applied for its depth.
	*/
	initImage: function() {
		var r = this.rectBasic;
		var scale = 0.55 + (0.45 * this.depth);
		var cw = Math.round(r.width * scale);
		var ch = Math.round(r.height * scale);

		this.image = document.createElement('canvas');
		this.image.setAttribute('width', cw);
		this.image.setAttribute('height', ch);
		var ctx = this.image.getContext('2d');

		ctx.scale(scale, scale);
		ctx.drawImage(this.parent.sprites, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);

		// Apply color transform based on percent depth.
		var img = ctx.getImageData(0, 0, cw, ch);
		var data = img.data;
		var p = 0.35 * (1 - this.depth);
			
		for (var i = 0; i < data.length; i) {
			data[i] = data[i++] * (1-p) + (115*p);
			data[i] = data[i++] * (1-p) + (208*p);
			data[i] = data[i++] * (1-p) + (189*p);
			i++; //data[i] = data[i++] * 1 + 0; << skip alpha component.
		}

		ctx.putImageData(img, 0, 0);
	},

	getScore: function() {
		return this.prize ? 50 : 1 + Math.round(9 * this.depth);
	},

	testHook: function(x, y) {
		if (!!this.animateTurn || this.dead) return false;
		return Hookable.testHook.apply(this, arguments);
	},

	rotate: function(radians) {
		this.rotation = radians + (Math.PI/2) * (-this.direction);
	},

	reset: function() {
		var minSpeed = 2;
		var maxSpeed = 6;
		var marginT = 50;
		var marginB = 100;
		var bounds = this.parent.bounds;
		
		// configure prize status.
		if (this.prize) {
			Fish.numPrize--;
		}

		this.prize = (this.index >= Fish.count - Fish.allowedPrizes && Fish.numPrize < Fish.allowedPrizes && Math.random() > 0.5);
		
		if (this.prize) {
			Fish.numPrize++;
		}
		
		this.frame = this.prize ? this.rectPrize : this.rectBasic;
		this.width = this.prize ? this.rectPrize.width : this.image.width;
		this.direction = (Math.random() > 0.5) ? -1 : 1;
		this.baseSpeed = Math.floor(4*(this.prize ? 1 : this.depth));
		this.burstSpeed = 0;
		this.rotation = 0;
		this.alpha = 1;
		this.x = (this.direction < 0) ? bounds.x + bounds.width + 10 : bounds.x - 10;
		this.y = (bounds.y + marginT) + (bounds.height - marginT - marginB) * Math.random();
		this.speedX = this.baseSpeed + minSpeed + (maxSpeed - minSpeed) * Math.random();
		this.speedY = 6 * Math.random() - 3;
		this.animateTurn = null;
		this.dead = false;
	},

	update: function() {
		if (this.hooked) return false;

		if (this.dead) {
			this.alpha = (this.alpha * 100 - 10) / 100;
			if (this.alpha <= 0) this.reset();
			return false;
		}

		// NOT DEAD.
		var bounds = this.parent.bounds;
		this.x += (this.speedX + this.burstSpeed) * this.scale * this.direction;
		this.y += this.speedY;

		if (this.x < bounds.x - this.width || this.x > bounds.x + bounds.width + this.width) {
			this.reset();
		}

		if (this.y <= bounds.y || this.y >= bounds.y + bounds.height) {
			this.speedY = 0;
		}
		
		// Run probability cases on fish behaviors.
		var prob = Math.random();
		var self = this;
		var rate;
			
		if (this.burstSpeed > 0) {
			// decrememt speed bursts.
			this.burstSpeed -= 0.5;

		} else if (!!this.animateTurn) {
			// animate fish turn direction.
			this.direction = this.animateTurn(this.direction);

		} else if (Math.round(100 * prob) === 0) {
			// initiate a speed burst.
			this.burstSpeed = 20 * Math.random();

		} else if (Math.round(150 * prob) === 150) {
			// initiate a turn sequence.
			rate = 0.28 * this.direction;

			this.animateTurn = function(dir) {
				dir -= rate;

				if (Math.abs(dir) >= 1) {
					dir = Math.round(dir);
					self.animateTurn = null;
				}
				return dir;
			};
		}

		this.unwind();
	},

	draw: function(ctx) {
		ctx.save();
		ctx.translate(this.x, this.y);

		if (this.rotation) {
			ctx.rotate(this.rotation);
		}
		
		if (this.direction !== 1) {
			ctx.scale(this.direction, 1);
		}
		
		if (this.alpha < 1) {
			ctx.globalAlpha = ctx.globalAlpha * this.alpha;
		}

		var r;

		if (this.prize) {
			// PRIZE FISH. Draw from source image.
			r = this.rectPrize;
			ctx.drawImage(this.parent.sprites, r.x, r.y, r.width, r.height, -r.width, -r.height/2, r.width, r.height);
		} else {
			// NORMAL FISH. Draw from colorized canvas.
			ctx.drawImage(this.image, -this.image.width, -this.image.height/2);
		}
	
		if (this.dead) {
			// DEAD FISH. Draw in zapping _sprites.
			r = this.rectZap;
			ctx.rotate(0);
			ctx.scale(1, 1);
			ctx.drawImage(this.parent.sprites, r.x, r.y, r.width, r.height, -r.width/2, -r.height/2, r.width, r.height);
		}

		ctx.restore();
	}
});

/**
* Controller object for managing hookable Jellyfish targets.
*/
function Jellyfish(game, index) {
	this.parent = game;
	this.index = index;
	this.depth = index / Jellyfish.count;
	this.blocker = true;
	this.width = this.frame.width;
	this.height = this.frame.height;
}

extend(Jellyfish, {
	count: 5
});

Jellyfish.prototype = extend(Hookable, {
	frame: Geom.rect(0, 0, 80, 105),
	speedPercent: 1,
	speedDecay: 1,
	animFrame: 0,
	animCycle: 0,
	testHookDist : 40,
	testHitDist: 70,

	getScore: function() {
		return -25;
	},

	reset: function() {
		var dir = (Math.random() < 0.5 ? -1 : 1);
		var marginT = 50;
		var marginB = 100;
		var bounds = this.parent.bounds;
			
		this.x = (dir < 1) ? bounds.x - this.width : bounds.x + bounds.width + this.width;
		this.y = (bounds.y + marginT) + ((bounds.height - marginT - marginB) * this.depth);
		this.speedDecay = 0.005 + (0.005 * Math.random());
		this.speedPercent = Math.random();
		this.frame = this.animCycle = 0;
		this.rotation = 0;
		this.resetX();
		this.resetY();
	},

	resetX: function() {
		var dir = 0;
		var edge = 250;
		var bounds = this.parent.bounds;
			
		if (this.x < bounds.x + this.edge) {
			dir = 1;
		} else if (this.x > bounds.x + bounds.width - edge) {
			dir = -1;
		} else {
			dir = (Math.random() < 0.5 ? -1 : 1);
		}

		this.speedX = (2 + (4 * Math.random())) * dir;
	},

	resetY: function() {
		var dir = 0;
		var bounds = this.parent.bounds;

		if (this.y < bounds.y + 75) {
			dir = 1;
		} else if (this.y > bounds.y + bounds.height - 100) {
			dir = -1;
		} else {
			dir = (Math.random() < 0.5 ? -1 : 1);
		}
		
		this.speedY = (1 + Math.random()) * dir;
	},

	update: function() {
		var bounds = this.parent.bounds;
		this.x += (this.speedX * this.speedPercent);
		this.y += (this.speedY * this.speedPercent);
		this.speedPercent -= this.speedDecay;

		if (this.speedPercent <= 0) {
			this.resetX();
			this.resetY();
			this.speedPercent = 1;
		}
		
		// reset once out of bounds.
		if ((this.x < bounds.x - this.width && this.speedX < 0) || 
			(this.x > bounds.x + bounds.width + this.width && this.speedX > 0)) {
				this.reset();
		}
		
		// update animation frame clocks.
		this.animCycle++;

		if (this.animCycle >= 4) {
			this.animCycle = 0;
			this.animFrame++;

			if (this.animFrame >= 6) {
				this.animFrame = 0;
			}
		}

		this.unwind();
	},

	draw: function(ctx) {
		ctx.save();
		ctx.translate(this.x, this.y);

		if (this.rotation) {
			ctx.rotate(this.rotation);
		}
		
		ctx.drawImage(this.parent.sprites, this.width * this.animFrame, this.height, this.width, this.height, -this.width/2, -20, this.width, this.height);
		ctx.restore();
	}
});

}).call(this);