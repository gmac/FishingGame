var Jellyfish = (function(bounds) {
	
	// Viewport edge padding (jellyfish must stay within these limits):
	var pad = {t:100, b:100, l:200, r:200};
	
	// Ease-out tweening function:
	function easeOut(t, b, c, d) {
		t /= d;
		return -c * t*(t-2) + b;
	}
	
	// Selects a random left/right direction:
	function direction() {
		return Math.random() < 0.5 ? -1 : 1;
	}
	
	function Jellyfish() {
		PIXI.MovieClip.call(this, this.frames);
		var stageLeft = Math.random() < 0.5;
		
		this.anchor.x = 0.5;
		this.anchor.y = 0.3;
		this.position.x = stageLeft ? bounds.x - this.width : bounds.x + bounds.width + this.width;
		this.position.y = (bounds.y + pad.t) + ((bounds.height - pad.t - pad.b) * Math.random());
		this.animationSpeed = 0.15;
		this.gotoAndPlay(Math.random() * this.frames.length);
		this.reset();
	}
	
	// Constructor/prototype:
	Jellyfish.constructor = Jellyfish;
	var PROTO = Jellyfish.prototype = Object.create(PIXI.MovieClip.prototype);
	
	// Animation frames:
	PROTO.frames = [];
	
	// Reset the sprite with a new movement trajectory:
	PROTO.reset = function() {
		var p = this.position;
		var dX = 0;
		var dY = 0;
		var edge = 250;
		
		// Set starting coords:
		this.sx = p.x;
		this.sy = p.y;
		
		// Pick X-direction:
		if (p.x < bounds.x + pad.l) dX = 1;
		else if (p.x > bounds.x + bounds.width - pad.r) dX = -1;
		else dX = direction();
		
		// Pick Y-direction:
		if (p.y < bounds.y + pad.t*2) dY = 1;
		else if (p.y > bounds.y + bounds.height - pad.b * 2) dY = -1;
		else dY = direction();
		
		// Set goal coords:
		this.gx = p.x + 250 * Math.random() * dX;
		this.gy = p.y + 150 * Math.random() * dY;
		this.gy = Math.max(bounds.y + pad.t, Math.min(this.gy, bounds.y + bounds.height - pad.b));
		
		// Pick new duration, reset time:
		this.d = 60 + Math.round(180 * Math.random());
		this.t = 0;
	};
	
	// Update the sprite during each redraw:
	PROTO.update = function() {
		this.position.x = easeOut(this.t, this.sx, this.gx-this.sx, this.d);
		this.position.y = easeOut(this.t, this.sy, this.gy-this.sy, this.d);
		if (this.t++ >= this.d) this.reset();
	};
	
	return Jellyfish;
	
}(Fishing.bounds));
