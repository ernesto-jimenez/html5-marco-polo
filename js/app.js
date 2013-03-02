function Game(container) {
  var scope = this;
  scope.visible = true;
  scope.translateCoords = true;
  scope.playSound = false;
  scope.playing = false;
  scope.container = container;
  scope.direction = 0;
  scope.keys = {
    38: 'forward',
    40: 'backward',
    39: 'right',
    37: 'left'
  };
  scope.gameplay = new Gameplay();
  scope.sound = new SoundPlayer(new webkitAudioContext());


  this.start = function () {
    if (!scope.canvas) {
      scope.canvas = document.createElement('canvas');
      scope.container.appendChild(scope.canvas);

      window.addEventListener('resize', onWindowResize, false);
      scope.canvas.addEventListener('mouseUp', scope.changePlace, false);
      document.body.addEventListener('keydown', function (event) {
        if (scope.keys[event.which]) {
          scope.instruction[scope.keys[event.which]] = true;
          event.preventDefault();
        }
      });
      document.body.addEventListener('keyup', function (event) {
        if (scope.keys[event.which]) {
          scope.instruction[scope.keys[event.which]] = false;
          event.preventDefault();
        }
      });
    }

    scope.gameplay.start();

    onWindowResize();
    scope.playing = true;
    scope.instruction = {};
    scope.update();
  };

  function onWindowResize () {
    scope.width = window.innerWidth;
    scope.height = window.innerHeight;

    scope.canvas.width = scope.width;
    scope.canvas.height = scope.height;
    scope.center = new THREE.Vector2(scope.width / 2, scope.height / 2);
    scope.context = scope.canvas.getContext('2d');
  }

  this.update = function () {
    if (!scope.playing) return;
    var time = new Date().getTime(),
    last = scope.lastUpdate || time,
    delta = (last - time) / 1000;
    window.requestAnimationFrame(scope.update);

    var instr = scope.instruction;

    if (instr.forward) { scope.gameplay.moveForward(delta); }
    if (instr.backward) { scope.gameplay.moveBackward(delta); }
    if (instr.right) { scope.gameplay.turnRight(delta); }
    if (instr.left) { scope.gameplay.turnLeft(delta); }

    scope.updateTranslation();
    if(scope.visible) { scope.draw(); }

    if(scope.playSound) {
      scope.sound.changePosition(scope.gameplay.relativePosition());
    } else {
      scope.sound.changePosition();
    }

    if (scope.gameplay.winsGame()) {
      alert('Victory!');
      scope.playing = false;
    }

    scope.lastUpdate = time;
  };

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  this.updateTranslation = function () {
    scope.playing = true;
    scope.translation = scope.translation || new THREE.Vector2();
    scope.translation.subVectors(scope.center, scope.gameplay.player.position);
  };

  this.worldToCam = function (v) {
    //return v;
    return scope.translateCoords ? scope.translation.clone().add(v) : v;
  };

  this.drawHud = function (ctx) {
    var orig = scope.worldToCam(new THREE.Vector2(0, 0)),
    axeX = scope.worldToCam(new THREE.Vector2(100, 0)),
    axeY = scope.worldToCam(new THREE.Vector2(0, 100));
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.moveTo(orig.x, orig.y);
    ctx.lineTo(axeY.x, axeY.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'blue';
    ctx.moveTo(orig.x, orig.y);
    ctx.lineTo(axeX.x, axeX.y);
    ctx.stroke();

    ctx.strokeStyle = 'brown';

    var gameplay = scope.gameplay,
        pos = scope.worldToCam(gameplay.player.position);

    ctx.beginPath();
    //ctx.translate(
      //Math.floor(scope.canvas.width / 2),
      //Math.floor(scope.canvas.height / 2));
    //ctx.rotate((scope.gameplay.player.direction + 90) * (Math.PI / 180));
    dir = scope.worldToCam(gameplay.deltaVector(1).setLength(-10).add(gameplay.player.position));

    ctx.fillStyle = "white";

    ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2, false);
    ctx.stroke();
    ctx.fill();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(dir.x, dir.y);
    ctx.stroke();
    ctx.restore();
  };

  this.drawObjective = function (ctx) {
    var gameplay = scope.gameplay,
        pos = scope.worldToCam(gameplay.objective.position);
        //pos = gameplay.relativePosition();

    ctx.save();
    ctx.beginPath();
    //ctx.translate(
      //Math.floor(scope.canvas.width / 2),
      //Math.floor(scope.canvas.height / 2));
    //ctx.rotate((gameplay.player.direction - 270) % 270 * (Math.PI / 180));

    ctx.arc(pos.x, pos.y, 10, 0, Math.PI*2, false);
    ctx.stroke();

    ctx.restore();
  };

  this.draw = function () {
    var ctx = scope.context;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, scope.width, scope.height);
    scope.drawHud(ctx);
    scope.drawObjective(ctx);
  };
}

function SoundPlayer(context) {
    var urls = ['position.wav'];
    var scope = this;
    this.isPlaying = false;
    var loader = new BufferLoader(context, urls, function (buffers) {
        scope.buffer = buffers[0];
    });
    loader.load();

    this.play = function () {
      var source = context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      var panner = context.createPanner();
      //panner.coneOuterGain = 0.1;
      //panner.coneOuterAngle = 180;
      //panner.coneInnerAngle = 0;
      panner.rolloffFactor = 0.1;
      panner.connect(context.destination);
      source.connect(panner);
      source.noteOn(0);
      context.listener.setPosition(0, 0, 0);
      scope.source = source;
      scope.panner = panner;
      scope.isPlaying = true;
    };

    this.stop = function () {
      if(scope.source) scope.source.noteOff(0);
      scope.isPlaying = false;
    };

    this.changePosition = function (position) {
      if (position) {
        if (!scope.isPlaying) {
          scope.play();
        }
        var mul = 1;
        var x = position.x;
        var y = -position.y;
        scope.panner.setPosition(x * mul, y * mul, 0);
      } else {
        scope.stop();
      }
    };
}

function Gameplay() {
  var scope = this;

  this.speed = 100;
  this.turnSpeed = 180;
  this.relativePos = new THREE.Vector2();

  this.player = {
    position: new THREE.Vector2(),
    direction: 270
  };

  this.objective = {
    position: new THREE.Vector2(),
    direction: 0
  };

  this.start = function () {
    this.player.position.set(200, 200);
    this.player.direction = 270;
    this.objective.position.set(100, 100);
    this.objective.direction = 0;
  };

  this.relativePosition = function () {
    return scope.relativePos.subVectors(scope.objective.position, scope.player.position);
  };

  this.turnRight = function (delta) {
    scope.player.direction -= scope.turnSpeed * delta;
  };

  this.turnLeft = function (delta) {
    scope.player.direction += scope.turnSpeed * delta;
  };

  this.deltaVector = function (delta) {
    var theta = scope.player.direction,
    distance = scope.speed * delta,
    deltaX = Math.cos(theta * (Math.PI / 180)) * distance,
    deltaY = Math.sin(theta * (Math.PI / 180)) * distance;

    //console.log({angle: theta, deltaX: deltaX, deltaY: deltaY});
    return new THREE.Vector2(deltaX, deltaY);
  };

  this.moveForward = function (delta) {
    scope.player.position.add(scope.deltaVector(delta));
  };

  this.moveBackward = function (delta) {
    scope.player.position.sub(scope.deltaVector(delta));
  };

  this.winsGame = function () {
    return scope.relativePosition().length() < 20;
  };
}

window.onload = function () {
  game = new Game(document.body);
  var gui = new dat.GUI();
  gui.add(game, 'start');
  gui.add(game, 'visible');
  gui.add(game, 'playSound');
  gui.add(game, 'translateCoords');
  game.start();
  var player = gui.addFolder('Player');
  player.add(game.gameplay.player, 'direction', 0, 360).listen();
  player.add(game.gameplay.player.position, 'y', -300, 300).listen();
  player.add(game.gameplay.player.position, 'x', -300, 300).listen();
  player.open();
  var objective = gui.addFolder('Objective');
  objective.add(game.gameplay.objective, 'direction', 0, 360);
  objective.add(game.gameplay.objective.position, 'y', -300, 300);
  objective.add(game.gameplay.objective.position, 'x', -300, 300);
  objective.open();
};

