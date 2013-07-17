var Fish = (function(bounds) {
	
	function Fish(index) {
		PIXI.Sprite.call(this, this.texture);
		this.index = index;
		this.anchor.x = 0.05;
		this.anchor.y = 0.5;
		this.reset();
	}
	
	// Constructor/prototype:
	Fish.constructor = Fish;
	var PROTO = Fish.prototype = Object.create(PIXI.Sprite.prototype);
	
	// Animation frames:
	PROTO.texture = null;
	PROTO.hooked = false;
	PROTO.dead = false;
	
	// Reset the sprite with a new movement trajectory:
	PROTO.reset = function() {
		var minSpeed=2,
			maxSpeed=6,
			marginT=50,
			marginB=100;
		
		this.direction = (Math.random() > 0.5) ? -1 : 1;
		this.baseSpeed = 3;
		this.burstSpeed = 0;
		this.rotation = 0;
		this.alpha = 1;
	
		this.position.x = (this.direction < 0) ? bounds.x + bounds.width + 10 : bounds.x - 10;
		this.position.y = (bounds.y+marginT) + (bounds.height-marginT-marginB)*Math.random();
		this.speedX = this.baseSpeed + minSpeed + (maxSpeed - minSpeed) * Math.random();
		this.speedY = 6*Math.random()-3;
		this.animateTurn = null;
		this.dead = false;
	};
	
	// Update the sprite during each redraw:
	PROTO.update = function() {
		
		if (this.dead) {
			this.alpha -= 0.1;
			if (this.alpha <= 0) this.reset();
			return;
		}
		
		// NOT DEAD.
		var p = this.position;
		p.x += (this.speedX + this.burstSpeed) * this.direction;
		p.y += this.speedY;

		if (p.x < bounds.x - this.width || this.x > bounds.x + bounds.width + this.width) {
			this.reset();
		}
		
		if (p.y <= bounds.y || this.y >= bounds.y + bounds.height) {
			this.speedY = 0;
		}
		
		/*/ Run probability cases on fish behaviors.
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
		*/
	};
	
	return Fish;
	
}(Fishing.bounds));
