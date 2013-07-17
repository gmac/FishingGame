/*global $, swfobject */
/*jslint browser: true, white: true, nomen: true, plusplus: true, vars: true */

/*window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame || 
		window.webkitRequestAnimationFrame || 
		window.mozRequestAnimationFrame	|| 
		window.oRequestAnimationFrame || 
		window.msRequestAnimationFrame || 
		function(callback, element){
			window.setTimeout(callback, 1000 / 60);
		};
})();*/

var fishingGame = (function(){
"use strict";

/**
* Main function for creating and managing a single fishing game instance.
*/
function FishingGame(domId) {
	
	/**
	* Geometry objects for defining points, rectangles, and colors.
	*/
	function point(px, py) { return {x:px, y:py}; }
	function rect(rx, ry, rw, rh) { return {x:rx, y:ry, width:rw, height:rh}; }
	function rgb(r, g, b) { return {r:r, g:g, b:b}; }
	
	/**
	* Define global scope variables.
	*/
	var _intro,
		_outro,
		_game,
		_score,
		_sound,
		_sprites,
		_net,
		_bounds = rect(0, 260, 1024, 440);
	
	/**
	* Controller object for interfacing with the game's sound player.
	*/
	function sound() {
		var _player,
			_audioEnabled = false;
		
		function _setupSound() {
			if (!_player) {
				_player = $('#fishing-sound').get(0);
				_audioEnabled = (!!_player && !!_player.startMusic);
			}
		}
		
		return {
			startMusic: function() {
				_setupSound();
				if (_audioEnabled) {
					_player.startMusic();
				}
			},
			stopMusic: function() {
				if (_audioEnabled) {
					_player.stopMusic();
				}
			},
			goodCatch: function() {
				if (_audioEnabled) {
					_player['catch']();
				}
			},
			badCatch: function() {
				if (_audioEnabled) {
					_player.block();
				}
			},
			block: function() {
				if (_audioEnabled) {
					_player.block();
				}
			},
			timeout: function() {
				if (_audioEnabled) {
					_player.timeout();
				}
			}
		};
	}
		
	/**
	* Object for managing the clock graphics display.
	* All timer behavior is controlled within the game iteself.
	*/
	function clock() {
		var _frame = rect(408, 0, 56, 56),
			_image = $('<canvas/>').attr({width:_frame.width, height:_frame.height}).get(0),
			_palette = [rgb(240,200,117), rgb(203,153,78), rgb(254,3,2)],
			_fill = rgb(0, 0, 0),
			_value = -1;
			
		function _renderClock(percent) {
			var radius = 23,
				r = _frame,
				radians = percent*2,
				a = percent > 0.5 ? _palette[0] : _palette[1],
				b = percent > 0.5 ? _palette[1] : _palette[2],
				p = 1-(percent > 0.5 ? percent-0.5 : percent)/0.5,
				ctx = _image.getContext('2d');
			
			ctx.save();
			ctx.clearRect(0, 0, r.width, r.height);
			ctx.translate(Math.round(r.width/2), Math.round(r.height/2)-2);
			
			// calculate fill color.
			_fill.r = Math.round(a.r+(b.r-a.r)*p);
			_fill.g = Math.round(a.g+(b.g-a.g)*p);
			_fill.b = Math.round(a.b+(b.b-a.b)*p);

			//ctx.save();
			//ctx.translate(this.x, this.y);
		
			// draw gray circle in the background.
			ctx.fillStyle = '#999999';
			ctx.beginPath();
			ctx.arc(0, 0, radius, 0, Math.PI*2);
			ctx.closePath();
			ctx.fill();
		
			// draw colored pie wedge.
			ctx.fillStyle = 'rgba('+_fill.r+','+_fill.g+','+_fill.b+',1)';
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, radius, -Math.PI/2, (Math.PI*2*percent)-Math.PI/2);
			ctx.lineTo(0, 0);
			ctx.closePath();
			ctx.fill();
		
			// Draw clock face.
			ctx.drawImage(_sprites, r.x, r.y, r.width, r.height, -r.width/2, -r.height/2+2, r.width, r.height);

			// Draw clock hand.
			ctx.fillStyle = "#000000";
			ctx.rotate(Math.PI*2*percent);
			ctx.beginPath();
			ctx.moveTo(-2, 3);
			ctx.lineTo(-0.5, 3-radius);
			ctx.lineTo(0.5, 3-radius);
			ctx.lineTo(2, 3);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
			
			// Store value.
			_value = Math.floor(percent*100);
		}
		
		return {
			x:974,
			y:50,
			draw: function(ctx, percent) {
				if (Math.floor(percent*100) !== _value) {
					// re-render the clock image each time the value changes.
					// this should only happen once per second rather than every frame.
					_renderClock(percent);
				}
				// draw the clock image into the game display.
				ctx.drawImage(_image, this.x-Math.round(_image.width/2), this.y-Math.round(_image.height/2));
			}
		};
	}
	
	/**
	* View controller for the hook display.
	*/
	function hook() {
		var ix=500,
			iy=350,
			i,
			_mouseHistory = [],
			_frame = rect(465, 0, 15, 26);
		
		// pre-populate mouse history with a collection of points.
		for (i=0; i < 5; i++) {
			_mouseHistory.push(point(ix, iy));
		}
			
		return {
			x: ix,
			y: iy,
			rotation: 0,
			payload: null, // HookableObject
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
				var prev = _mouseHistory[0],
					next = _mouseHistory.pop(),
					a = prev.x-next.x,
					b = prev.y-next.y,
					move = Math.sqrt(a*a + b*b),
					avX = 0,
					avY = 0,
					av,
					pt,
					last,
					i;
					
				next.x = mx;
				next.y = Math.max(my, _bounds.y-60);
				_mouseHistory.unshift(next);

				// Calculate average position of all recorded mouse positions.
				this.trendX = 0;
				this.trendY = 0;
				av = _mouseHistory.length;
				
				for (i=0; i < av; i++) {
					pt = _mouseHistory[i];
					avX += pt.x;
					avY += pt.y;

					if (!!last) {
						this.trendX += (last.x - pt.x);
						this.trendY += (last.y - pt.y);
					}
					last = pt;
				}
			
				// Set hook position to average mouse position.
				this.x = avX/av;
				this.y = avY/av;
				if (move > 2) {
					this.rotation = Math.atan2(this.trendY, this.trendX)+Math.PI/2;
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
				var r = _frame,
					offset = (!!this.payload ? r.height : 0);
					
				ctx.save();
				ctx.translate(this.x, this.y);
				ctx.rotate( this.rotation );
				ctx.drawImage(_sprites, r.x, r.y+offset, r.width, r.height, -3, -3, r.width, r.height);
				ctx.restore();
			}
		};
	}
	
	/**
	* View controller for the multiplier display.
	*/
	function multiplier() {
		var _isActive = false;
		return {
			view: $('<canvas/>').get(0),
			x: 560,
			y: 140,
			alpha: 1,
			isActive: function() {
				return _isActive;
			},
			reset: function(x, negative) {
				_isActive = (x > 1);
				
				if (_isActive) {
					var txt = 'x'+x,
						ctx = this.view.getContext('2d');
						
					this.view.width = 40;
					this.view.height = 26;
					this.alpha = 1;
					this.y = 140;
					
					ctx.font = "20px/1em 'PlugNickel', Arial, Helvetica, sans-serif";
					ctx.lineWidth = 4;
					ctx.lineJoin = "round";
					ctx.textBaseline = "top";
					ctx.strokeStyle = "#000000";
					ctx.fillStyle = negative ? "#FF0000" : "#FFFFFF";
					ctx.clearRect(0, 0, this.view.width, this.view.height);
					ctx.strokeText(txt, 3, 3);
					ctx.fillText(txt, 3, 3);
				}
				return this;
			},
			draw: function(ctx) {
				ctx.save();
				ctx.globalAlpha = ctx.globalAlpha * this.alpha;
				ctx.drawImage(this.view, this.x, this.y);
				ctx.restore();
				this.alpha-=0.025;
				this.y-=2;
				
				_isActive = (this.alpha > 0);
			}
		};
	}
	
	/**
	* Controller object for managing hookable targets.
	* This object is the base prototype for Fish and Jellyfish objects.
	*/
	function HookableObject() {}
	(function initHookableObject(){
		HookableObject.prototype = {
			index:0,
			depth:0,
			x:0,
			y:0,
			scale:1,
			alpha:1,
			width:0,
			height:0,
			blocker:false,
			hooked:false,
			dead:false,
			speedX:0,
			speedY:0,
			frame:rect(0, 0, 1, 1),
			imageX:0,
			imageY:0,
			rotation:0,
			rotate: function(radians) {
				this.rotation = radians;
			},
			unwind: function() {
				var inc = 0.17,
					pi = Math.PI;
				
				// Reduces rotation in small increments until it reaches zero.
				// This method is intended to be called externally with the framerate.
				if (this.rotation === 0) {
					return;
				}
			
				// correct extreme rotations by turning them back to within range of a single circle.
				if (this.rotation < 0) {
					while (this.rotation < 0) {
						this.rotation += pi*2;
					}
				} else if (this.rotation > pi*2) {
					while (this.rotation > pi*2) {
						this.rotation -= pi*2;
					}
				}
			
				// increment rotation in the nearest direction back to zero.
				if (this.rotation < pi && this.rotation-inc > 0) {
					this.rotation -= inc;
				} else if (this.rotation > pi && this.rotation+inc < pi*2) {
					this.rotation += inc;
				} else {
					this.rotation = 0;
				}
			},
			getScore: function() {
				return 1;
			},
			testHook: function(x, y) {
				var a = this.x-x, b = this.y-y;
				return (Math.sqrt(a*a + b*b) < 20);
			},
			testHit: function(x, y) {
				var a = this.x-x, b = this.y-y;
				return (Math.sqrt(a*a + b*b) < 20);
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
	}());
	
	/**
	* Controller object for managing hookable Fish targets.
	*/
	function Fish(index){
		this.index = index;
		this.depth = index/Fish.count;
		this.image = this.render();
	}
	(function initFish(){
		Fish.count = 15;
		Fish.numPrize = 0;
		Fish.allowedPrizes = 2;
		Fish.prototype = new HookableObject();
		Fish.prototype.image = null;
		Fish.prototype.direction = 1;
		Fish.prototype.baseSpeed = 0;
		Fish.prototype.burstSpeed = 0;
		Fish.prototype.prize = false;
		Fish.prototype.animateTurn = null; // function for reversing the fish direction.
		Fish.prototype.rectBasic = rect(18, 0, 94, 38);
		Fish.prototype.rectPrize = rect(0, 40, 112, 52);
		Fish.prototype.rectZap = rect(112, 0, 115, 103);

		/**
		* Specifies the points awarded for catching the fish.
		*/
		Fish.prototype.getScore = function() {
			return this.prize ? 50 : 1+Math.round(9*this.depth);
		};

		/**
		* Tests a position to see if it is close enough to registration to count as a capture.
		* Automatically restricts capture while fish is dead or in the process of turning.
		*/
		Fish.prototype.testHook = function(x, y) {
			if (!!this.animateTurn || this.dead) {
				return false;
			}
			var a = this.x-x,
				b = this.y-y;
			return (Math.sqrt(a*a + b*b) < 20);
		};

		/**
		* Sets the fish rotation. Rotation will be adjusted to account for mirroring.
		*/
		Fish.prototype.rotate = function(radians) {
			this.rotation = radians + (Math.PI/2) * (-this.direction);
		};
	
		/**
		* Resets the fish to a new random speed and position off-screen.
		*/
		Fish.prototype.reset = function() {
			var minSpeed=2,
				maxSpeed=6,
				marginT=50,
				marginB=100;
				
			if (!this.image) {
				this.image = this.render();
			}
			
			// configure prize status.
			if (this.prize) {
				Fish.numPrize--;
			}
			this.prize = (this.index >= Fish.count-Fish.allowedPrizes && Fish.numPrize < Fish.allowedPrizes && Math.random() > 0.5);
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
		
			this.x = (this.direction < 0) ? _bounds.x+_bounds.width+10 : _bounds.x-10;
			this.y = (_bounds.y+marginT) + (_bounds.height-marginT-marginB)*Math.random();
			this.speedX = this.baseSpeed + minSpeed + (maxSpeed - minSpeed) * Math.random();
			this.speedY = 6*Math.random()-3;
			this.animateTurn = null;
			this.dead = false;
		};
	
		/**
		* Updates the fish position and behavior each frame.
		*/
		Fish.prototype.update = function() {
			if (this.hooked) {
				return;
			}
			
			if (!this.dead) {
				// NOT DEAD.
				this.x += (this.speedX + this.burstSpeed) * this.scale * this.direction;
				this.y += this.speedY;
		
				if (this.x < _bounds.x-this.width || this.x > _bounds.x+_bounds.width+this.width) {
					this.reset();
				}
				if (this.y <= _bounds.y || this.y >= _bounds.y+_bounds.height) {
					this.speedY = 0;
				}
				
				// Run probability cases on fish behaviors.
				var prob = Math.random(),
					self = this,
					rate;
					
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
							self = self.animateTurn = null;
						}
						return dir;
					};
				}
				this.unwind();
			
			} else {
				// DEAD.
				this.alpha = (this.alpha*100-10)/100;
				if (this.alpha <= 0) {
					this.reset();
				}
			}
		};
	
		/**
		* Draws the fish to the canvas.
		*/
		Fish.prototype.draw = function(ctx) {
			var r;
			ctx.save();
			ctx.translate(this.x, this.y);
			if (this.rotation !== 0) {
				ctx.rotate(this.rotation);
			}
			
			if (this.direction !== 1) {
				ctx.scale(this.direction, 1);
			}
			
			if (this.alpha < 1) {
				ctx.globalAlpha = ctx.globalAlpha * this.alpha;
			}
			
			if (this.prize) {
				// PRIZE FISH. Draw from source image.
				r = this.rectPrize;
				ctx.drawImage(_sprites, r.x, r.y, r.width, r.height, -r.width, -r.height/2, r.width, r.height);
			} else {
				// NORMAL FISH. Draw from colorized canvas.
				ctx.drawImage(this.image, -this.image.width, -this.image.height/2);
			}
		
			if (this.dead) {
				// DEAD FISH. Draw in zapping _sprites.
				r = this.rectZap;
				ctx.rotate(0);
				ctx.scale(1, 1);
				ctx.drawImage(_sprites, r.x, r.y, r.width, r.height, -r.width/2, -r.height/2, r.width, r.height);
			}
			ctx.restore();
		};
	
		/**
		* Renders an image of the fish with a color transformation applied for its depth.
		*/
		Fish.prototype.render = function() {
			var canvas = $('<canvas/>'),
				scale=0.55+(0.45*this.depth),
				r = this.rectBasic,
				cw = Math.round(r.width*scale),
				ch = Math.round(r.height*scale),
				ctx = canvas.attr({width:cw, height:ch}).get(0).getContext('2d'),
				img,
				data,
				len,
				p = 0.35*(1-this.depth),
				i;
				
			ctx.scale(scale, scale);
			ctx.drawImage(_sprites, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);

			// Apply color transform based on percent depth.
			img = ctx.getImageData(0, 0, cw, ch);
			data = img.data;
			len = data.length;
				
			for (i = 0; i < len; i) {
				data[i] = data[i++] * (1-p) + (115*p);
				data[i] = data[i++] * (1-p) + (208*p);
				data[i] = data[i++] * (1-p) + (189*p);
				i++; //data[i] = data[i++] * 1 + 0; << skip alpha component.
			}
			ctx.putImageData(img, 0, 0);
			$("body").append(canvas);
			return canvas.get(0);
		};
	}());
	
	/**
	* Controller object for managing hookable Jellyfish targets.
	*/
	function Jellyfish(index) {
		this.index = index;
		this.depth = index/Jellyfish.count;
		this.blocker = true;
		this.width = this.frame.width;
		this.height = this.frame.height;
	}
	(function initJellyfish(){
		Jellyfish.count = 5;
		Jellyfish.prototype = new HookableObject();
		Jellyfish.prototype.frame = rect(0, 0, 80, 105);
		Jellyfish.prototype.speedPercent = 1;
		Jellyfish.prototype.speedDecay = 1;
		Jellyfish.prototype.animFrame = 0;
		Jellyfish.prototype.animCycle = 0;
	
		/**
		* Specifies the points awarded for catching a jellyfish.
		*/
		Jellyfish.prototype.getScore = function() {
			return -25;
		};
		
		/**
		* Tests a position to see if it is close enough to registration to count as a capture.
		* Automatically restricts capture while fish is in the process of turning.
		*/
		Jellyfish.prototype.testHook = function(x, y) {
			var a = this.x-x, b = this.y-y;
			return (Math.sqrt(a*a + b*b) < 40);
		};
		Jellyfish.prototype.testHit = function(x, y) {
			var a = this.x-x, b = this.y-y;
			return (Math.sqrt(a*a + b*b) < 75);
		};
		
		/**
		* Resets the jellyfish position and motion trends.
		*/
		Jellyfish.prototype.reset = function() {
			var dir = (Math.random() < 0.5 ? -1 : 1),
				marginT=50,
				marginB=100;
				
			this.x = (dir < 1) ? _bounds.x - this.width : _bounds.x + _bounds.width + this.width;
			this.y = (_bounds.y + marginT) + ((_bounds.height - marginT - marginB) * this.depth);
			this.speedDecay = 0.005 + (0.005 * Math.random());
			this.speedPercent = Math.random();
			this.frame = this.animCycle = 0;
			this.rotation = 0;
			this.resetX();
			this.resetY();
		};
		
		Jellyfish.prototype.resetX = function() {
			var dir = 0,
				edge = 250;
				
			if (this.x < _bounds.x+this.edge) {
				dir = 1;
			} else if (this.x > _bounds.x+_bounds.width-edge) {
				dir = -1;
			} else {
				dir = (Math.random() < 0.5 ? -1 : 1);
			}
			this.speedX = (2 + (4 * Math.random())) * dir;
		};
		
		Jellyfish.prototype.resetY = function() {
			var dir = 0;
			
			if (this.y < _bounds.y + 75) {
				dir = 1;
			} else if (this.y > _bounds.y + _bounds.height - 100) {
				dir = -1;
			} else {
				dir = (Math.random() < 0.5 ? -1 : 1);
			}
			
			this.speedY = (1 + Math.random()) * dir;
		};
		
		/**
		* Updates the fish position and behavior each frame.
		*/
		Jellyfish.prototype.update = function() {
			this.x += (this.speedX * this.speedPercent);
			this.y += (this.speedY * this.speedPercent);
			this.speedPercent -= this.speedDecay;

			if (this.speedPercent <= 0) {
				this.resetX();
				this.resetY();
				this.speedPercent = 1;
			}
			
			// reset once out of _bounds.
			if ((this.x < _bounds.x - this.width && this.speedX < 0) || 
				(this.x > _bounds.x + _bounds.width + this.width && this.speedX > 0)) {
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
		};
		
		/**
		* Draws the jellyfish to the canvas each frame.
		*/
		Jellyfish.prototype.draw = function(ctx) {
			ctx.save();
			ctx.translate(this.x, this.y);
			if (this.rotation !== 0) {
				ctx.rotate(this.rotation);
			}
			
			ctx.drawImage(_sprites, this.width*this.animFrame, this.height, this.width, this.height, -this.width/2, -20, this.width, this.height);
			ctx.restore();
		};
	}());

	/**
	* Creates a view controller for the net graphic.
	*/
	function net(parent){
		var _frame = rect(0, 215, 110, 170),
			_playing = false,
			_currentFrame = 0,
			_currentCycle = 0,
			_maxFrames = 3,
			_maxCycles = 1,
			_direction = 1,
			_bgCoords = function(x, y) { return '-'+x+'px -'+y+'px'; };
		
		return {
			view:$('<div/>')
				.addClass('fishing-game-net')
				.css({
					backgroundPosition:_bgCoords(_frame.x, _frame.y),
					height:_frame.height,
					left:546,
					top:66,
					width:_frame.width
				})
				.appendTo(parent),
			update: function() {
				if (_playing) {
					if (_currentCycle++ > _maxCycles) {
						_currentCycle = 0;
						_currentFrame+=_direction;
						this.redraw();
						
						if (_currentFrame >= _maxFrames) {
							_direction = -1;
						} else if (_currentFrame <= 0) {
							this.stop();
						}
					}
				}
			},
			redraw: function() {
				var left = _frame.x+_frame.width*_currentFrame;
				this.view.css({backgroundPosition:_bgCoords(left, _frame.y)});
			},
			play: function() {
				_playing = true;
			},
			stop: function() {
				_playing = false;
				_direction = 1;
				_currentFrame = 0;
				_currentCycle = 0;
			}
		};
	}
	
	/**
	* Creates a view controller for the intro screen.
	*/
	function intro(parent){
		return {
			view:$('<div/>')
				.addClass('fishing-view fishing-intro')
				.append(
					$('<button/>')
					.addClass('fishing-intro-start')
					.text('Start!')
					.click(function(){
						_intro.hide();
						_game.startGame();
					})
				)
				.appendTo(parent)
				.hide(),
			show:function(){
				this.view.show();
				_score.hide();
			},
			hide:function(){
				this.view.hide();
				_score.show();
			}
		};
	}
	
	/**
	* Creates a view controller for the outro screen.
	*/
	function outro(parent){
		return {
			view:$('<div/>')
				.addClass('fishing-view fishing-outro')
				.append(
					$('<button/>')
					.addClass('fishing-outro-replay')
					.text('Replay')
					.click(function(){
						_outro.hide();
						_game.startGame();
					})
				).append(
					$('<button/>')
					.addClass('fishing-outro-restart')
					.text('Restart')
					.click(function(){
						_outro.hide();
						_intro.show();
					})
				)
				.appendTo(parent)
				.hide(),
			show:function(){
				this.view.show();
			},
			hide:function(){
				this.view.hide();
			}
		};
	}
	
	/**
	* Creates a view controller for the game screen.
	*/
	function game(parent){
		var _alpha = 1,
			_points = 0,
			_multiplier = 1,
			_seconds = 0,
			_secondsMax = 30,
			_hookables = [], // Array of hookable Fish & Jellyfish objects.
			_target = rect(545, 175, 105, 40), // Rect of the drag-to target (net).
			_frameRate, // setInterval ID of the framerate interval.
			_timeOut, // setTimeout ID of the timer timeout.
			_delayBlockers = 0, // post-block time delay when blockers may not be caught.
			_scoredThisSecond = false, // tracks if a fish was caught during the last second.
			_messageField = $('<div/>').addClass('fishing-game-message'),
			_playing = false,
			_running = false;
		
		return {
			view:$('<div/>')
				.addClass('fishing-view fishing-game')
				.append(_messageField)
				.hide()
				.appendTo(parent),
			canvas:$('<canvas/>'), // main drawing canvas for the game.
			hook:hook(),
			clock:clock(),
			multiplier:multiplier().reset(4, true),
			mouseX:0,
			mouseY:0,
			
			/**
			* Specifies if the game program is currently running.
			*/
			isRunning:function(){
				return _running;
			},
			
			/**
			* Resets the game setup and starts the framerate.
			*/
			startGame:function(){
				var self=this,
					nfish=_hookables.length,
					i;
					
				Fish.allowedPrizes = 2;
			
				// Reset all fish.
				for (i=0; i < nfish; i++) {
					_hookables[i].reset();
				}
				
				// Reset game variables.
				_alpha = 1;
				_points = 0;
				_multiplier = 1;
				_seconds = _secondsMax+1;
				_score.text( _points );
				
				// methodology for starting actual game play.
				// this will be called after the intro sequence completes.
				var runProgram = function() {
					// Configure mouse movement tracker.
					$(document).mousemove(function(evt){
						var offset = self.view.offset();
						self.mouseX = evt.pageX - offset.left;
						self.mouseY = evt.pageY - offset.top;
					});
					
					_messageField.text('').hide();
					_sound.startMusic();
					_playing = true;
					_running = true;
					
					self.updateTimer();
					self.update();
				};
				
				// Play intro sequence.
				_messageField.text('Get Ready').show();
				_timeOut = setTimeout(function(){
					_messageField.text('Fish!');
					_timeOut = setTimeout(runProgram, 1000);
				}, 1500);
				
				this.multiplier.reset(1);
				this.view.show();
			},
		
			/**
			* Disables the framerate to kill all game playback.
			*/
			stopProgram:function(){
				if (!!_frameRate) {
					$(document).unbind('mousemove');
					clearTimeout(_timeOut);
					clearTimeout( _frameRate );
					_timeOut = null;
					_frameRate = null;
				}
				_running = false;
				
				this.view.hide();
				_sound.stopMusic();
				_outro.show();
			},
		
			/**
			* Ends a gameplay sequence.
			* Program will keep running until outro sequence completes.
			*/
			endGame:function(){
				if (_playing) {
					_playing = false;
					_sound.timeout();
					this.hook.unhookObject();
				}
			},
			
			/**
			* Schedules an animation frame.
			* Designed to interface at some point with the native browser animation API.
			* Currently configured as a chained timeout set to run at 30fps.
			*/
			requestAnimFrame:function(){
				var self=this;
				_frameRate = setTimeout(function(){self.update();}, 1000/35);
			},
		
			/**
			* Called upon each frame refresh.
			*/
			update:function() {
				var ctx = this.canvas.get(0).getContext('2d'),
					cw = ctx.canvas.width,
					ch = ctx.canvas.height; // canvas width and height.

				// Decrememt game alpha when no longer playing.
				// Stop game once display has completely faded out.
				if (!_playing) {
					_alpha = Math.round((_alpha-0.05)*100)/100; //<< avoid repeating decimals.
					if (_alpha <= 0) {
						this.stopProgram();
					}
				}
			
				// decrement post-blocker grace period.
				if (_delayBlockers > 0) {
					_delayBlockers--;
				}
				
				ctx.moveTo(0, 0);
				ctx.clearRect(0, 0, cw, ch);
				ctx.globalAlpha = _alpha;
				ctx.strokeStyle = 'rgba(100,100,100,0.5)';
				ctx.lineWidth = 1;

				// Update hook position.
				this.hook.update(this.mouseX, this.mouseY);
			
				// Update all fish objects.
				var blocker,
					fish,
					nfish=_hookables.length,
					i;
					
				for (i=0; i < nfish; i++) {
					fish = _hookables[i];

					// test for catches.
					if (!this.hook.payload && this.hook.trendY < 0 && _playing) {
						if ( fish.testHook(this.hook.x, this.hook.y) ) {
							if (!fish.blocker || _delayBlockers === 0) {
								this.hook.hookObject( fish );
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
					_sound.block();
					_delayBlockers = 10;
				}
							
				// Test for points
				if (!!this.hook.payload && 
				this.hook.y < _target.y+_target.height &&
				this.hook.x < _target.x+_target.width &&
				this.hook.x > _target.x) {
					var points = this.hook.catchObject() * _multiplier;
					_points += points;
					_score.text( _points );
					_net.play();
					
					if (points > 0) {
						_sound.goodCatch();
					} else {
						_sound.badCatch();
					}
					
					// configures the multiplier graphic.
					this.multiplier.reset(_multiplier, points<0);
				
					if (points > 0) {
						_scoredThisSecond = true;
						_multiplier++;
						Fish.allowedPrizes++;
					} else {
						_multiplier = 1;
					}
				}
				
				// Render multiplier display.
				if (this.multiplier.isActive()) {
					this.multiplier.draw(ctx);
				}
				
				// Redraw hook and fishing line.
				this.hook.draw(ctx);
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(340, 25);
				ctx.quadraticCurveTo(340, 300, this.hook.x, this.hook.y);
				ctx.stroke();
				ctx.closePath();
				ctx.restore();
			
				// redraw the countdown clock.
				this.clock.draw(ctx, _seconds/_secondsMax);
				_net.update();
				
				// request next animation frame while program is running.
				if (_running) {
					this.requestAnimFrame();
				}
			},
		
			/**
			* Called upon each timer cycle.
			*/
			updateTimer:function() {
				var self=this;
				_seconds--;
			
				// decrement number of allowed prizes if bonus has accrued.
				if (!_scoredThisSecond && Fish.allowedPrizes > 2) {
					Fish.allowedPrizes--;
				}
				
				if (!_scoredThisSecond) {
					_multiplier = 1;
				}
				
				_scoredThisSecond = false;
			
				if (_seconds > 0) {
					_timeOut = setTimeout(function(){self.updateTimer();}, 1000/1);
				} else {
					this.endGame();
				}
			},
		
			/**
			* Initializes the game controller object.
			*/
			launch:function(){
				var self=this, i;
				this.canvas.attr({
					width:this.view.width(),
					height:this.view.height()
					}).appendTo( this.view );

				// Create all fish & jellyfish objects.
				for (i=0; i < Fish.count; i++) {
					_hookables.push( new Fish(i) );
				}
				for (i=0; i < Jellyfish.count; i++) {
					_hookables.push( new Jellyfish(i) );
				}
				
				$("#playback").click(function(evt){
					evt.preventDefault();
					if (self.isRunning()) {
						self.endGame();
						$(this).text("run");
					} else {
						self.startGame();
						$(this).text("stop");
					}
				});
			}
		};
	}

	/**
	* Initializes the fishing game object.
	*/
	(function init() {
		var self=this;
		
		// Main container
		var dom = $('#'+domId);
		_intro = intro(dom);
		_outro = outro(dom);
		_net = net(dom);
		_game = game(dom);
		_score = $('<div/>').addClass('fishing-game-score').appendTo(dom);
		_sound = sound();

		// Sound container
		var soundId = 'fishing-sound';
		$('<div/>').attr({id:soundId}).appendTo(dom);
		
		// Embed sound SWF.
		swfobject.embedSWF("media/sound.swf", soundId, "1", "1", "9.0.45", false, {}, {}, {
			id:soundId,
			name:soundId
		});

		// _sprites sheet image
		_sprites = $('<img/>')
			.attr({src:'media/sprites.png'})
			.hide()
			.appendTo(dom)
			.imagesLoaded(function(){
				_game.launch();
				_intro.show();
			})
			.get(0);
	}());
}

/**
* Fishing Game instantiation API.
*/
return {
	init:function(id) { 
		return new FishingGame(id);
	}
};

}());